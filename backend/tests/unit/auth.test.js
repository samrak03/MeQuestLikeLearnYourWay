
import { jest } from '@jest/globals';

// Define mocks
const mockMysqlQuery = jest.fn();
const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();
const mockJwtSign = jest.fn();

// Mock modules using unstable_mockModule (required for ESM)
jest.unstable_mockModule('../../src/config/db.mysql.js', () => ({
    mysqlConn: {
        query: mockMysqlQuery,
    },
}));

jest.unstable_mockModule('bcryptjs', () => ({
    default: {
        hash: mockBcryptHash,
        compare: mockBcryptCompare,
    },
}));

jest.unstable_mockModule('jsonwebtoken', () => ({
    default: {
        sign: mockJwtSign,
    },
}));

// Import modules AFTER mocking
const authController = await import('../../src/controllers/auth.controller.js');

describe('Auth Controller', () => {
    let req, res;

    beforeEach(() => {
        req = { body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
        };
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should return 400 if fields are missing', async () => {
            req.body = { email: 'test@test.com' }; // missing password/nickname
            await authController.register(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should return 409 if email exists', async () => {
            req.body = { email: 'exist@test.com', password: '123', nickname: 'user' };
            mockMysqlQuery.mockResolvedValueOnce([[{ id: 1 }]]); // existing user found

            await authController.register(req, res);
            expect(res.status).toHaveBeenCalledWith(409);
        });

        it('should create user and return 201', async () => {
            req.body = { email: 'new@test.com', password: '123', nickname: 'user' };
            mockMysqlQuery.mockResolvedValueOnce([[]]); // no existing user
            mockBcryptHash.mockResolvedValue('hashed_pw');
            mockMysqlQuery.mockResolvedValueOnce([{ insertId: 1 }]); // insert success

            await authController.register(req, res);

            expect(mockBcryptHash).toHaveBeenCalledWith('123', 10);
            expect(mockMysqlQuery).toHaveBeenCalledTimes(2); // check + insert
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: '회원가입 성공' }));
        });
    });

    describe('login', () => {
        it('should return 401 if user not found', async () => {
            req.body = { email: 'wrong@test.com', password: '123' };
            mockMysqlQuery.mockResolvedValueOnce([[]]); // empty result

            await authController.login(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return 401 if password mismatch', async () => {
            req.body = { email: 'user@test.com', password: 'wrong_pw' };
            const mockUser = { id: 1, email: 'user@test.com', password_hash: 'hashed_pw' };
            mockMysqlQuery.mockResolvedValueOnce([[mockUser]]);
            mockBcryptCompare.mockResolvedValue(false);

            await authController.login(req, res);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should return token on success', async () => {
            req.body = { email: 'user@test.com', password: 'correct_pw' };
            const mockUser = { id: 1, email: 'user@test.com', password_hash: 'hashed_pw', nickname: 'tester' };
            mockMysqlQuery.mockResolvedValueOnce([[mockUser]]);
            mockBcryptCompare.mockResolvedValue(true);
            mockJwtSign.mockReturnValue('mock_token');

            await authController.login(req, res);

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                token: 'mock_token',
                user: expect.objectContaining({ email: 'user@test.com' })
            }));
        });
    });
});

