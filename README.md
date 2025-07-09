# IoT Data Collector

An IoT data ingestion and analytics API built with Express and MySQL.

## 🚀 Features

- **Data Ingestion:** Collects data from IoT devices via RESTful API
- **Data Storage:** Stores time-series data in MySQL database
- **Analytics API:** Provides RESTful endpoints for data retrieval and analysis
- **Health Monitoring:** Built-in health check endpoints
- **Dockerized:** Fully containerized for easy deployment and scaling
- **Production Ready:** Includes testing, linting, and error handling

## 🛠 Technologies

- **Backend:** Node.js, Express.js
- **Database:** MySQL
- **Containerization:** Docker, Docker Compose
- **Testing:** Jest, Supertest
- **Linting:** ESLint
- **Environment:** dotenv for configuration

## 📋 Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- MySQL (if running locally without Docker)

## ⚡ Quick Start

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/t0x3e8/iot_data_collection_service.git
cd iot_data_collection_service

# Run with Docker Compose (includes database)
npm run docker:prod
```

The application will be available at `http://localhost:3000`

### Option 2: Local Development

```bash
# Clone and install
git clone https://github.com/t0x3e8/iot_data_collection_service.git
cd iot_data_collection_service
npm install

# Set up environment
cp .env.example .env
# Edit .env with your database credentials

# Option A: Run with containerized database
npm run dev:with-db

# Option B: Run locally (requires MySQL running)
npm start
```

## ⚙️ Environment Configuration

Create a `.env` file with the following variables:

```env
# Database Configuration
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=iot_data

# Application Configuration
PORT=3000
NODE_ENV=development

# Optional: Add any other required environment variables
```

## 📡 API Endpoints

### Health Check
```http
GET /health
```
Returns the application health status.

### Data Ingestion
```http
POST /api/data
Content-Type: application/json

{
  "deviceId": "sensor-001",
  "temperature": 23.5,
  "humidity": 60.2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Data Retrieval
```http
# Get all data (with optional pagination)
GET /api/data?page=1&limit=100

# Get specific data by ID
GET /api/data/:id

# Get data by device (if supported)
GET /api/data?deviceId=sensor-001
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

## 🔍 Code Quality

```bash
# Check for linting errors
npm run lint

# Automatically fix linting errors
npm run lint:fix
```

## 🚀 Deployment

### Docker Production Deployment

```bash
# Build and run production container
docker-compose -f docker-compose.prod.yml up -d

# Or using npm script
npm run docker:prod
```

### Manual Deployment

1. Ensure MySQL database is running and accessible
2. Set production environment variables
3. Install dependencies: `npm ci --only=production`
4. Start the application: `npm start`

## 📊 Monitoring

The application includes:
- Health check endpoint at `/health`
- Structured logging
- Error handling middleware
- Database connection monitoring

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## 📝 API Documentation

For detailed API documentation, consider adding:
- Swagger/OpenAPI documentation
- Postman collection
- Example requests/responses

## 🔧 Troubleshooting

### Common Issues

**Database Connection Error:**
```
Error: Missing required environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
```
- Ensure your `.env` file is properly configured
- Verify database credentials and connectivity

**Port Already in Use:**
```
Error: listen EADDRINUSE: address already in use :::3000
```
- Change the PORT in your `.env` file
- Kill the process using the port: `lsof -ti:3000 | xargs kill`

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Express.js](https://expressjs.com/)
- Database support by [MySQL](https://www.mysql.com/)
- Containerization with [Docker](https://www.docker.com/)
