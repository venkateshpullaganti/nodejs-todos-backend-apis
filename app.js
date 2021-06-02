const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const dateFns = require("date-fns");

const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "todoApplication.db");

const priorityValues = ["HIGH", "MEDIUM", "LOW"];
const statusValues = ["TO DO", "IN PROGRESS", "DONE"];
const categoryValues = ["WORK", "HOME", "LEARNING"];

const parseAndFormatDate = (date) => {
  const parsedDate = dateFns.parse(date, "yyyy-MM-dd", new Date());
  return dateFns.format(new Date(parsedDate), "yyyy-MM-dd");
};

const isValidDate = (date) => {
  const splittedDate = date.split("-");
  const parsedDate = dateFns.parse(date, "yyyy-M-d", new Date());
  return (
    splittedDate[0].length === 4 &&
    splittedDate[1] &&
    splittedDate[2] &&
    dateFns.isValid(parsedDate)
  );
};

const dataValidator = (
  { status, priority, category, date, dueDate },
  response,
  next
) => {
  if (status && !statusValues.includes(status)) {
    response.status(400);
    response.send("Invalid Todo Status");
  } else if (priority && !priorityValues.includes(priority)) {
    response.status(400);
    response.send("Invalid Todo Priority");
  } else if (category && !categoryValues.includes(category)) {
    response.status(400);
    response.send("Invalid Todo Category");
  } else if (
    (date && !isValidDate(date)) ||
    (dueDate && !isValidDate(dueDate))
  ) {
    response.status(400);
    response.send("Invalid Due Date");
  } else {
    next();
  }
};

const validateQueryParams = (request, response, next) => {
  dataValidator(request.query, response, next);
};

const validateTodosBodyData = (request, response, next) => {
  dataValidator(request.body, response, next);
};

const initialiseDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at localhost:3000");
    });
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initialiseDBAndServer();

const formatTodo = ({ id, todo, category, priority, status, due_date }) => {
  return {
    id,
    todo,
    category,
    priority,
    status,
    dueDate: due_date,
  };
};

app.get("/todos/", validateQueryParams, async (request, response) => {
  const {
    status = "",
    priority = "",
    search_q = "",
    category = "",
  } = request.query;
  let getTodosQuery = `
        SELECT * FROM todo 
      WHERE status LIKE '%${status}%' 
      AND  priority LIKE '%${priority}%'
      AND    todo LIKE '%${search_q}%'
      AND category LIKE '%${category}%'
  `;

  const getTodos = await db.all(getTodosQuery);
  const formattedResponse = getTodos.map((todo) => formatTodo(todo));
  response.send(formattedResponse);
});

app.get("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const getTodoQuery = `SELECT * FROM todo WHERE id=${todoId};`;

  const todo = await db.get(getTodoQuery);

  response.send(formatTodo(todo));
});

app.get("/agenda/", validateQueryParams, async (request, response) => {
  const { date } = request.query;
  const formattedDate = parseAndFormatDate(date);

  const getTodosQuery = `SELECT * FROM todo WHERE due_date = '${formattedDate}'`;
  const dbTodos = await db.all(getTodosQuery);
  const formattedTodos = dbTodos.map((todo) => formatTodo(todo));
  response.send(formattedTodos);
});

app.post("/todos/", validateTodosBodyData, async (request, response) => {
  const { id, todo, category, priority, status, dueDate } = request.body;
  const formattedDate = parseAndFormatDate(dueDate);

  const createTodoQuery = `INSERT INTO 
    todo(id, todo, category, priority, status, due_date) 
    VALUES('${id}','${todo}','${category}','${priority}','${status}','${formattedDate}')`;

  await db.run(createTodoQuery);
  response.send("Todo Successfully Added");
});

app.put("/todos/:todoId/", validateTodosBodyData, async (request, response) => {
  const { todoId } = request.params;
  let responseText = null;
  let updateQuery = null;

  const todoDetails = request.body;

  if (todoDetails.status) {
    responseText = "Status Updated";
  } else if (todoDetails.priority) {
    responseText = "Priority Updated";
  } else if (todoDetails.todo) {
    responseText = "Todo Updated";
  } else if (todoDetails.category) {
    responseText = "Category Updated";
  } else if (todoDetails.dueDate) {
    responseText = "Due Date Updated";
  }

  const getPerviousTodoQuery = `SELECT * FROM todo WHERE id=${todoId};`;
  const previousTodo = await db.get(getPerviousTodoQuery);

  const {
    status = previousTodo.status,
    priority = previousTodo.priority,
    todo = previousTodo.todo,
    category = previousTodo.category,
    dueDate = previousTodo.due_date,
  } = request.body;

  const updateTodoQuery = `UPDATE todo 
  SET todo ='${todo}',status='${status}',priority='${priority}',category = '${category}',due_date='${dueDate}'
   WHERE id=${todoId}`;

  await db.run(updateTodoQuery);
  response.send(responseText);
});

app.delete("/todos/:todoId/", async (request, response) => {
  const { todoId } = request.params;
  const deleteTodoQuery = `DELETE FROM todo WHERE id=${todoId};`;

  await db.run(deleteTodoQuery);
  response.send("Todo Deleted");
});

module.exports = app;
