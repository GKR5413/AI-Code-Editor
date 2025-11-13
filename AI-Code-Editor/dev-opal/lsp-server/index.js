// LSP Server - Future Enhancement Placeholder
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3003;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'LSP Server placeholder - under development' });
});

app.listen(PORT, () => {
  console.log(`LSP Server placeholder running on port ${PORT}`);
});
