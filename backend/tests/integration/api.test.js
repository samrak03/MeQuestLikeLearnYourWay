
import { jest } from '@jest/globals';
import request from 'supertest';

// Mock DB before importing app
jest.unstable_mockModule('../../src/config/db.mysql.js', () => ({
    mysqlConn: {
        getConnection: jest.fn().mockResolvedValue({ release: jest.fn() }),
        query: jest.fn().mockResolvedValue([[]]),
    }
}));

jest.unstable_mockModule('../../src/config/db.postgres.js', () => ({
    pgPool: {
        connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
    }
}));

// Import app AFTER mocking
// Use dynamic import for the app module to ensure mocks are applied
const { default: app } = await import('../../src/app.js');

describe('API Integration', () => {
    it('GET / should return 200 and welcome message', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toContain('Backend server is running');
    });

    it('GET /unknown-route should return 404', async () => {
        const res = await request(app).get('/api/unknown');
        expect(res.statusCode).toEqual(404);
    });
});
