import express from "express"
import morgan from "morgan";
import expenseRoute from "./routers/expense.js";


const app = express()
const PORT = 3003
morgan("dev")

// Midleware
app.use(express.json())
app.use("/expense", expenseRoute)







// Home Page Get All Expense and Users
// app.get("/", );

// Add an expense with a description and amount
// app.post("/",);

// Get Expense By ID 
// app.get("/expense/:id",);

// Delete An Expense 
// app.delete("/expense/:id",)


// Update the expense

// app.patch("/expense/:id")


// app.get("/summary", )


app.listen(PORT, () => {
    console.log(`Server is running on port http://localhost:${PORT}`);
})