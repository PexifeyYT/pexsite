const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.use('/p', createProxyMiddleware({
  target: 'https://pizzaedition.win',
  changeOrigin: true,
  pathRewrite: { '^/p': '' },
  on: {
    error: function(err, req, res) {
      res.status(502).end();
    }
  }
}));

app.listen(PORT);
