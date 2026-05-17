const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

app.listen(port, () => {
    console.log("Node js Server");
  console.log(`Server running on port ${port}`);

});
