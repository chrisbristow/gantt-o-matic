async function draw_gantt_chart(elem, json_file)
{
  document.getElementById(elem).innerHTML = "Loading ...";

//  try
//  {
    const response = await fetch(json_file);

    if(!response.ok)
    {
      document.getElementById(elem).innerHTML = "Fetch failed: " + response.status;
    }
    else
    {
      const json = await response.json();

      compose_tasks(elem, json);
    }
//  }
//  catch(error)
//  {
//    document.getElementById(elem).innerHTML = "Error: " + error.message;
//  }
}

function compose_tasks(elem, json)
{
  convert_dates(json);

  json.grid = [];

  title_col(json);
  day_cols(json);

  let to_do = true;
  let count = 0;

  while(to_do && count < 1000)
  {
    to_do = update_dependencies(json);
    json.grid = [];
    title_col(json);
    day_cols(json);
    count ++;
  }

  draw_tasks(elem, json);
}

function draw_tasks(elem, json)
{
  let g_html = `<div class="gom_scroller"><div class="gom_grid">`;

  for(let i = 0; i < json.grid.length; i ++)
  {
    for(let j = 0; j < json.grid[i].length; j ++)
    {
      g_html += `<div class="${json.grid[i][j].class}" style="grid-column: ${i+1}; grid-row: ${j+1};">${json.grid[i][j].text}</div>`;
    }
  }

  g_html += `</div></div>`;

  document.getElementById(elem).innerHTML = g_html;
}

function title_col(json)
{
  let t_col = [{ text: "&nbsp;", class: "gom_text gom_blank gom_sticky" }];

  // Add task names to the first column in the grid:
  for(let i = 0; i < json.tasks.length; i ++)
  {
    t_col.push({ text: "&nbsp;&nbsp;&nbsp;".repeat(json.tasks[i].level) + json.tasks[i].name, class: "gom_text gom_text_" + json.tasks[i].level + " gom_sticky" });
  }

  json.grid.push(t_col);
}

function day_cols(json)
{
  let current_date = new Date();
  let final_date = new Date();

  for(let i = 0; i < json.tasks.length; i ++)
  {
    let t_date = new Date(from_date_string(json.tasks[i].start));

    // If the task is working days only, shift the start to the next working day:
    if(json.tasks[i].working_days_only && t_date.getDay() === 6)
    {
      t_date = new Date(t_date.getTime() + 86400000);
    }

    if(json.tasks[i].working_days_only && t_date.getDay() === 0)
    {
      t_date = new Date(t_date.getTime() + 86400000);
    }

    // Obtain the earliest start date for all tasks:
    if(t_date < current_date)
    {
      current_date = t_date;
    }

    // Obtain a list of working days for each task and add to the JSON:
    let task_days = [];

    for(let j = 0; j < json.tasks[i].duration; j ++)
    {
      task_days.push(to_date_string(t_date));

      t_date = new Date(t_date.getTime() + 86400000);

      // Set the next available date after this task completes:
      json.tasks[i].fin = to_date_string(t_date);

      // Nudge forward from Saturday if this task is working days only:
      if(json.tasks[i].working_days_only && t_date.getDay() === 6)
      {
        t_date = new Date(t_date.getTime() + 86400000);
      }

      // Nudge forward from Sunday if this task is working days only:
      if(json.tasks[i].working_days_only && t_date.getDay() === 0)
      {
        t_date = new Date(t_date.getTime() + 86400000);
      }
    }

    // Obtain the final date for all tasks:
    if(t_date > final_date)
    {
      final_date = t_date;
    }

    json.tasks[i].task_days = task_days;
  }

  // If there are more dates to process:
  while(current_date < final_date)
  {
    add_more_date_cols(json, current_date);

    current_date = new Date(current_date.getTime() + 86400000);
  }
}

function format_date(d)
{
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth()+1).toString().padStart(2, "0");
  const year = d.getFullYear().toString();
  const dow = get_dow(d.getDay());

  return(dow + "<br/><nobr>" + day + "-" + month + "-" + year + "</nobr>");
}

function to_date_string(d)
{
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth()+1).toString().padStart(2, "0");
  const year = d.getFullYear().toString();

  return(year + month + day);
}

function from_date_string(s)
{
  let ds = s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);

  return(ds);
}

function get_dow(d)
{
  const dows = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return(dows[d]);
}

function add_more_date_cols(json, current_date)
{
  let sfx = "";

  if(current_date.getDay() === 0 || current_date.getDay() === 6)
  {
    sfx = "_weekend";
  }

  const now = new Date();

  if(current_date.getDate() === now.getDate()
     && current_date.getMonth() === now.getMonth()
     && current_date.getFullYear() === now.getFullYear())
  {
    sfx = "_now";
  }

  let t_col = [{ text: format_date(current_date), class: "gom_text gom_dates" + sfx }];

  for(let i = 0; i < json.tasks.length; i ++)
  {
    let add_block = false;

    for(let j = 0; j < json.tasks[i].task_days.length; j ++)
    {
      const tt_date = new Date(from_date_string(json.tasks[i].task_days[j]));
      const t_day = tt_date.getDate();
      const t_month = tt_date.getMonth();
      const t_year = tt_date.getFullYear();

      if(current_date.getDate() === t_day
         && current_date.getMonth() === t_month
         && current_date.getFullYear() === t_year)
      {
        add_block = true;
      }
    }

    // Add an "allocated" or "free" indicator block to the grid:
    if(add_block)
    {
      t_col.push({ text: "&nbsp;", class: "gom_text gom_text_" + json.tasks[i].level + " gom_allocated_" + json.tasks[i].level })
    }
    else
    {
      t_col.push({ text: "&nbsp;", class: "gom_text gom_text_" + json.tasks[i].level + " gom_free" + sfx })
    }
  }

  json.grid.push(t_col);
}

function update_dependencies(json)
{
  let starts = {};
  let fins = {};
  let alterations = false;

  // Create lookup tables of other task start/end dates:
  for(let i = 0; i < json.tasks.length; i ++)
  {
    starts[json.tasks[i].name] = json.tasks[i].start;
    fins[json.tasks[i].name] = json.tasks[i].fin;
  }

  for(let i = 0; i < json.tasks.length; i ++)
  {
    // For tasks with dependencies on other tasks:
    if(json.tasks[i].after !== undefined)
    {
      let latest_after = "00000000";

      // Obtain the latest next available date from a list of preceding tasks:
      for(let j = 0; j < json.tasks[i].after.length; j ++)
      {
        if(fins[json.tasks[i].after[j]] > latest_after)
        {
          latest_after = fins[json.tasks[i].after[j]];
        }
      }

      if(latest_after !== json.tasks[i].start)
      {
        json.tasks[i].start = latest_after;
        alterations = true;
      }
    }
    else if(json.tasks[i].align !== undefined)
    {
      // If a task is not dependent on others, but should be aligned with another task, set its start date:
      if(json.tasks[i].start !== starts[json.tasks[i].align])
      {
        json.tasks[i].start = starts[json.tasks[i].align];
        alterations = true;
      }
    }
  }

  return(alterations);
}

function convert_dates(json)
{
  for(let i = 0; i < json.tasks.length; i ++)
  {
    // If a task has no start date, add one set to today:
    if(json.tasks[i].start === undefined)
    {
      json.tasks[i].start = to_date_string(new Date());
    }
  }
}