const public_holidays = 
{
  "20241225": ".",
  "20241226": ".",
  "20250101": ".",
  "20250418": ".",
  "20250421": ".",
  "20250505": ".",
  "20250526": ".",
  "20250825": ".",
  "20251225": ".",
  "20251226": ".",
  "20260101": ".",
  "20260403": ".",
  "20260406": ".",
  "20260504": ".",
  "20260525": ".",
  "20260831": ".",
  "20261225": ".",
  "20261228": "."
};

if(typeof window === 'undefined')
{
  const fs = require('fs');

  if(process.argv.length != 4)
  {
    console.log("Usage: gom.js <project_definition_file> <weekly:true/false>");
    process.exit(1);
  }

  const file_contents = fs.readFileSync(process.argv[2]).toString().split("\n");
  const o_json = generate_json(file_contents, process.argv[3]);

  console.log(JSON.stringify(o_json, null, 2));
}

async function draw_gantt_chart(elem, json_file)
{
  document.getElementById(elem).innerHTML = "Loading ...";

  try
  {
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
  }
  catch(error)
  {
    document.getElementById(elem).innerHTML = "Ready";
  }
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

  if(json.weekly_summary)
  {
    prepare_weekly_grid(json);
  }

  draw_tasks(elem, json);

//    console.log(JSON.stringify(json, null, 2));
//    console.log(count);
}

function draw_tasks(elem, json)
{
  let g_html = `<div class="gom_grid">`;

  for(let i = 0; i < json.grid.length; i ++)
  {
    for(let j = 0; j < json.grid[i].length; j ++)
    {
      g_html += `<div class="${json.grid[i][j].class}" style="grid-column: ${i+1}; grid-row: ${j+1};" title="${json.grid[i][j].text.replaceAll("&nbsp;", "")}">${json.grid[i][j].text}</div>`;
    }
  }

  g_html += `</div>`;

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
    t_date = get_next_working_day(t_date, json.tasks[i].working_days_only);

    // Obtain the earliest start date for all tasks:
    if(t_date < current_date)
    {
      current_date = t_date;
    }

    // Obtain a list of working days for each task and add to the JSON:
    if(json.tasks[i].duration !== undefined)
    {
      let task_days = [];

      for(let j = 0; j < json.tasks[i].duration; j ++)
      {
        task_days.push(to_date_string(t_date));

        t_date = new Date(t_date.getTime() + 86400000);

        // Set the next available date after this task completes:
        json.tasks[i].fin = to_date_string(t_date);

        // Nudge forward from Saturday if this task is working days only:
        t_date = get_next_working_day(t_date, json.tasks[i].working_days_only);
      }

      // Obtain the final date for all tasks:
      if(t_date > final_date)
      {
        final_date = t_date;
      }

      json.tasks[i].task_days = task_days;
    }
  }

  // If there are more dates to process:
  while(current_date < final_date)
  {
    add_more_date_cols(json, current_date);

    current_date = new Date(current_date.getTime() + 86400000);
  }
}

// Create a date string: <day_name> <day> <month> <year>
function format_date(d)
{
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth()+1).toString().padStart(2, "0");
  const year = d.getFullYear().toString();
  const dow = get_dow(d.getDay());

  return(dow + "<br/><nobr>" + day + "-" + month + "-" + year + "</nobr>");
}

// Create a date string: <year> <month> <day>
function to_date_string(d)
{
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth()+1).toString().padStart(2, "0");
  const year = d.getFullYear().toString();

  return(year + month + day);
}

// Create a Date() from a string: <yyyy>-<mm>-<dd>
function from_date_string(s)
{
  let ds = s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);

  return(ds);
}

// Detect days of the week:
function get_dow(d)
{
  const dows = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return(dows[d]);
}

// Check if a date is a public holiday:
function is_public_holiday(d)
{
  let iph = false;

  if(public_holidays[to_date_string(d)] === ".")
  {
    iph = true;
  }

  return(iph);
}

// Nudge a date forward if a day, or sequence of days are non-working days:
function get_next_working_day(t_date, wdo)
{
  if(wdo)
  {
    let not_working_day = true;

    while(not_working_day)
    {
      if(t_date.getDay() === 6 || t_date.getDay() === 0 || is_public_holiday(t_date))
      {
        t_date = new Date(t_date.getTime() + 86400000);
      }
      else
      {
        not_working_day = false;
      }
    }
  }

  return(t_date);
}

function add_more_date_cols(json, current_date)
{
  let sfx = "";

  if(current_date.getDay() === 0 || current_date.getDay() === 6 || is_public_holiday(current_date))
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

  // Update task_days, start and fin for a "span' task:
  for(let i = 0; i < json.tasks.length; i ++)
  {
    if(json.tasks[i].span !== undefined && json.tasks[i].duration === undefined)
    {
      let ntd_u = {};

      for(let j = 0; j < json.tasks[i].span.length; j ++)
      {
        for(let k = 0; k < json.tasks.length; k ++)
        {
          if(json.tasks[k].name === json.tasks[i].span[j])
          {
            for(let l = 0; l < json.tasks[k].task_days.length; l ++)
            {
              ntd_u[json.tasks[k].task_days[l]] = "x";
            }
          }
        }
      }

      let new_task_days = Object.keys(ntd_u);

      new_task_days.sort();

      if(JSON.stringify(new_task_days) !== JSON.stringify(json.tasks[i].task_days))
      {
        json.tasks[i].task_days = new_task_days;
        json.tasks[i].start = new_task_days.at(0);
        json.tasks[i].fin = new_task_days.at(-1);
        alterations = true;
      }
    }
  }

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

    // Initialise task_days:
    json.tasks[i].task_days = [];
  }
}

function prepare_weekly_grid(json)
{
  json.weekly_grid = [JSON.parse(JSON.stringify(json.grid[0]))];

  let grid_col = JSON.parse(JSON.stringify(json.grid[1]));

  for(let i = 2; i < json.grid.length; i ++)
  {
    // Push at end of current week:
    if(json.grid[i][0].text.startsWith("Monday"))
    {
      json.weekly_grid.push(grid_col);
      grid_col = JSON.parse(JSON.stringify(json.grid[i]));
    }

    for(let j = 1; j < json.grid[i].length; j ++)
    {
      if(json.grid[i][j].class.indexOf("gom_allocated") > -1)
      {
        grid_col[j] = { "text": "&nbsp;", "class": json.grid[i][j].class };
      }
    }
  }

  // Push final week:
  json.weekly_grid.push(grid_col);

    //console.log(JSON.stringify(json.weekly_grid, null, 2));

  json.grid = json.weekly_grid;
}

function generate_json(file_contents, is_weekly_str)
{
  let is_weekly = false;

  if(is_weekly_str === "true")
  {
    is_weekly = true;
  }

  let output_json =
  {
    "weekly_summary": is_weekly,
    "tasks": []
  };

  let dep_tasks = [];
  let prev_dep_tasks = [];
  let start_date = "";
  let span_name = "";
  let span_tasks = [];
  let level = 0;
  let span_cache = [];

  for(let i = 0; i < file_contents.length; i ++)
  {
    if(file_contents[i].match(/^\s*\-\s*\d+\s*:\s*/))
    {
      const res = /^\s*\-\s*(\d+)\s*:\s*(.+)$/.exec(file_contents[i]);
      const duration = parseInt(res[1]);
      const task_name = res[2].trim();

      dep_tasks.push(task_name);

      let new_task =
      {
        "name": task_name,
        "level": level,
        "duration": duration,
        "working_days_only": true
      };

      if(start_date.length > 0)
      {
        new_task.start = start_date;
      }
      else if(prev_dep_tasks.length > 0)
      {
        new_task.after = prev_dep_tasks;
      }

      if(span_name.length === 0)
      {
        output_json.tasks.push(new_task);
      }
      else
      {
        span_cache.push(new_task);
        span_tasks.push(task_name);
      }
    }
    else if(file_contents[i].match(/^\s*\-\s*\d+\s*=\s*/))
    {
      const res = /^\s*\-\s*(\d+)\s*=\s*(.+)$/.exec(file_contents[i]);
      const duration = parseInt(res[1]);
      const task_name = res[2].trim();

      dep_tasks.push(task_name);

      let new_task =
      {
        "name": task_name,
        "level": level,
        "duration": duration,
        "working_days_only": false
      };

      if(prev_dep_tasks.length > 0)
      {
        new_task.after = prev_dep_tasks;
      }

      if(start_date.length > 0)
      {
        new_task.start = start_date;
      }

      if(span_name.length === 0)
      {
        output_json.tasks.push(new_task);
      }
      else
      {
        span_cache.push(new_task);
        span_tasks.push(task_name);
      }
    }
    else if(file_contents[i].match(/^\s*$/))
    {
      prev_dep_tasks = [];
      dep_tasks = [];
      start_date = "";
    }
    else if(file_contents[i].match(/^\s*\|\s*$/))
    {
      prev_dep_tasks = dep_tasks;
      dep_tasks = [];
      start_date = "";
    }
    else if(file_contents[i].match(/^\s*\d\d\d\d\-\d\d\-\d\d\s*$/))
    {
      const res = /^\s*(\d\d\d\d)\-(\d\d)\-(\d\d)\s*$/.exec(file_contents[i]);
      const year = res[1];
      const month = res[2];
      const day = res[3];

      start_date = year + month + day;
      dep_tasks = [];
      prev_dep_tasks = dep_tasks;
    }
    else if(file_contents[i].match(/^\s*\[\s*.+$/))
    {
      const res = /^\s*\[\s*(.+)$/.exec(file_contents[i]);
      span_name = res[1].trim();
      level = 1;
    }
    else if(file_contents[i].match(/^\s*\]\s*$/))
    {
      output_json.tasks.push(
        {
          "name": span_name,
          "level": 0,
          "working_days_only": true,
          "span": span_tasks
        }
      );

      span_name = "";
      span_tasks = [];
      level = 0;

      for(let j = 0; j < span_cache.length; j ++)
      {
        output_json.tasks.push(span_cache[j]);
      }

      span_cache = [];
    }
    else if(file_contents[i].match(/^\s*A\s*:\s*/))
    {
      const res = /^\s*A\s*:\s*(.+)$/.exec(file_contents[i]);
      const task_name = res[1].trim();

      prev_dep_tasks.push(task_name);
    }
  }

  return(output_json);
}

function render(ta, elem, is_weekly)
{
  const defn = document.getElementById(ta).value;
  const o_json = generate_json(defn.split("\n"), is_weekly);

  compose_tasks(elem, o_json);
}