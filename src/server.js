import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import blogRouter from './routes/blogRoutes.js'
import { connectDB } from './config/db.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5001

app.use(express.json())
app.use(cors());

// Normalize duplicate slashes in incoming requests
app.use((req, res, next) => {
    req.url = req.url.replace(/\/{2,}/g, '/');
    next();
});

app.use('/blogs', blogRouter)

connectDB().then(() => {
    app.listen(PORT, () => {
    console.log(`Server running at ${PORT}`)
    })
})
