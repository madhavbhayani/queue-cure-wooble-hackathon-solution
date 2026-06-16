const express = require('express');
const cors = require('cors');
const { connectDB } = require('./internal/database/connection/db.js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, 'internal/.env') });

const app = express();
const port = 8080;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const authRoutes = require('./internal/routes/auth.routes.js');
app.use('/api/auth', authRoutes);

const sessionRoutes = require('./internal/routes/session.routes.js');
app.use('/api/session', sessionRoutes);

// Health endpoint for testing
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is healthy' });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Node js express server started at port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server due to database connection issue', error);
    process.exit(1);
  }
};

startServer();
