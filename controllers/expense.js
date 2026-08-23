import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto"


//Importing files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Path to DATA
const dataPath = path.join(__dirname, "../data/userdata.json")
let data = JSON.parse(fs.readFileSync(dataPath, "utf-8"))
//function to read the PATH
const readData = () => {
    const fileContent = fs.readFileSync(dataPath, "utf-8");
    return JSON.parse(fileContent);
};

// Get ALL
export const getALlExpenses = (req, res) => {
    res.status(200).json({
        status: "Successful",
        statusCode: 200,
        length: data.length,
        expenses: data
    });
}

//POST an Expense
export const createExpense = (req, res) => {
    const uniqueId = crypto.randomUUID();
    const newExpense = Object.assign({ id: uniqueId }, req.body);

    data.push(newExpense);

    // 2. Write the whole 'data' object, not just 'data.expenses'
    fs.writeFile(dataPath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ status: "error", message: "Failed to save data" });
        }

        res.status(201).json({
            status: "success",
            results: data.length, // 3. Use data.expenses.length
            data: { data: newExpense }
        });



    });
}
export const getExpenseById = (req, res) => {
    const expenseId = req.params.id;

    // Fix: search inside data.expenses, not data directly
    const singleExpense = data.find((expense) => expense.id === expenseId);

    if (!singleExpense) {
        return res.status(404).json({
            status: "Failed",
            message: "An Expense with THAT ID is not FOUND"
        });
    }

    // Fix: use res.json() instead of res.send(json(...))
    res.status(200).json({
        status: "Successful",
        result: 1,
        data: { expense: singleExpense } // cleaned up nested data object too
    });
}

export const deleteExpense = (req, res) => {


    const expenseId = req.params.id
    const expenseIndex = data.findIndex((expense => expense.id === expenseId))


    if (expenseIndex === -1) {
        return res.status(404).json({
            status: "fail",
            message: "No expense found with that ID"
        });
    }

    data.splice(expenseIndex, 1)

    fs.writeFile(dataPath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ status: "error", message: "Failed to save data" });
        }

        res.status(204).json({
            status: "success",
            data: null
        });


    });


}

export const updateExpense = (req, res) => {
    const expenseId = req.params.id
    const expenseIndex = data.findIndex((expense => expense.id === expenseId))


    if (expenseIndex === -1) {
        return res.status(404).json({
            status: "fail",
            message: "Expense not found"
        });
    }

    data[expenseIndex] = Object.assign({}, data[expenseIndex], req.body)

    fs.writeFile(dataPath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            return res.status(500).json({ status: "error", message: "Failed to save data" });
        }

        res.status(200).json({
            status: "success",
            data: { data: data[expenseIndex] }
        });
    });
}

export const getSummaryExpense = (req, res) => {
    try {
        const data = readData();
        const { month } = req.query;
        let expenses = data.filter((item) => item.amount !== undefined);

        if (month) {
            expenses = expenses.filter((expense) => {
                const expenseMonth = new Date(expense.date).getMonth() + 1;
                return expenseMonth === Number(month);
            });
        }

        const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

        res.status(200).json({
            status: "success",
            filter: month ? `Month: ${month}` : "All-time",
            count: expenses.length,
            totalExpenses: totalExpenses
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ status: "error", message: "Internal server error" });
    }

}