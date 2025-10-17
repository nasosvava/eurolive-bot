// src/web/routes.js (create if you don’t have one)
import express from 'express';
import { selfTestCanvasText } from '../charts/smoke.js';
import { selfTestChartText } from '../charts/chartSmoke.js';

export function mountRoutes(app) {
    app.get('/font-test', (req, res) => {
        try {
            const png = selfTestCanvasText();
            res.type('png').send(png);
        } catch (e) {
            res.status(500).send(String(e?.stack || e));
        }
    });

    app.get('/chart-test', async (req, res) => {
        try {
            const png = await selfTestChartText();
            res.type('png').send(png);
        } catch (e) {
            res.status(500).send(String(e?.stack || e));
        }
    });
}
