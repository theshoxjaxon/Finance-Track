import express from "express"

import { getALlExpenses, createExpense, updateExpense, deleteExpense, getSummaryExpense, getExpenseById } from "../controllers/expense.js"

const router = express.Router()

router.param("id", (req, res, next, val) => {
    console.log(`The value is ${val}`)
    next()
})

router.route("/summary").get(getSummaryExpense)
router.route("/").get(getALlExpenses).post(createExpense)
router.route("/:id").get(getExpenseById).delete(deleteExpense).patch(updateExpense)

export default router