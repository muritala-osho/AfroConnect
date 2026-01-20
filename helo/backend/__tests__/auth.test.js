
const request = require('supertest');
const mongoose = require('mongoose');
const { app } = require('../server');
const User = require('../models/User');

describe('Authentication', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST || process.env.MONGODB_URI);
  });

  afterAll(async () => {
    await User.deleteMany({ email: /test.*@test\.com/ });
    await mongoose.connection.close();
  });

  describe('POST /api/auth/signup', () => {
    it('should create a new user and send OTP', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test123@test.com',
          password: 'password123'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.userId).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test456@test.com',
          password: 'password123'
        });

      const res = await request(app)
        .post('/api/auth/signup')
        .send({
          email: 'test456@test.com',
          password: 'password123'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should reject invalid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'wrongpassword'
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
