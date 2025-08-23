"use strict";
const express = require("express");
const app = express();
const path = require('path');

const mentionWebhook = require('./webhook/mention');
const makeitaquote = require('./src/miaq');
const getchat = require('./webhook/webhook');
const wakajiho = require('./webhook/jihou');
const wakajihohook = require('./webhook/jihouwebhook');

const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.end(JSON.stringify(process.versions, null, 2));
});

app.post("/webhook", (req, res) => {
  mentionWebhook.mentionWebhook(req, res);
});

app.post("/getchat", (req, res) => {
  getchat(req, res);
});

app.get('/pp', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'miaq.html'));
});          

app.all("/generate", (req, res) => {
  makeitaquote.makeitaquote(req, res);
});

app.post("/jiho", (req, res) => {
  wakajiho.jihou(req, res);
});

app.post("/jihowebhook", (req, res) => {
  wakajihohook.mentionWebhook(req, res);
});

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})
