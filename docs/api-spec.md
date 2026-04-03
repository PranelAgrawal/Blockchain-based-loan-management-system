# API Specification

Base URL: `http://localhost:5000/api`

## Authentication

All protected routes require header:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## Auth Endpoints

### POST /auth/register
Register a new user.

**Request Body:**
```json
{
  "name": "string (required)",
  "email": "string (required)",
  "password": "string (required, min 6)",
  "walletAddress": "string (optional, 0x...)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "name": "string",
    "email": "string",
    "walletAddress": "string",
    "role": "user",
    "creditScore": 300,
    "kycVerified": false,
    "token": "JWT_STRING"
  }
}
```

**Errors:** 400 (validation, duplicate email/wallet)

---

### POST /auth/login
Login user.

**Request Body:**
```json
{
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "name": "string",
    "email": "string",
    "walletAddress": "string",
    "role": "string",
    "creditScore": number,
    "kycVerified": boolean,
    "token": "JWT_STRING"
  }
}
```

**Errors:** 401 (invalid credentials)

---

### GET /auth/me
Get current user profile. **Protected.**

**Response (200):**
```json
{
  "success": true,
  "data": { "User object" }
}
```

---

### PUT /auth/wallet
Update wallet address. **Protected.**

**Request Body:**
```json
{
  "walletAddress": "string (required, 0x...)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "User object" }
}
```

---

## KYC Endpoints

### POST /kyc/upload
Upload KYC document. **Protected.**

**Request Body:**
```json
{
  "documentUrl": "string (required)",
  "documentType": "id_card | passport | drivers_license (optional)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "status": "pending",
    "documentUrl": "string",
    "documentType": "string"
  }
}
```

---

### POST /kyc/verify
Trigger KYC verification. **Protected.** Admin can pass userId.

**Request Body:**
```json
{
  "userId": "string (optional, admin only)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "kyc": { "KYC object" },
    "user": { "User object" },
    "alreadyVerified": boolean
  }
}
```

---

### GET /kyc/status
Get KYC status. **Protected.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "not_submitted | pending | verified | rejected",
    "documentUrl": "string",
    "documentType": "string",
    "verifiedAt": "date",
    "blockchainVerified": boolean
  }
}
```

---

## Loan Endpoints

### POST /loan/request
Validate and/or confirm loan request. **Protected.**

**Request Body:**
```json
{
  "amount": "number (required)",
  "duration": "number (required, days)",
  "loanType": "Personal | Home | Business (required)",
  "txHash": "string (optional, required to confirm after MetaMask tx)"
}
```

**Response (200 - validation only):**
```json
{
  "success": true,
  "message": "Validation passed...",
  "data": {
    "amount": number,
    "duration": number,
    "loanType": "string",
    "collateralRequired": boolean
  }
}
```

**Response (201 - with txHash):**
```json
{
  "success": true,
  "data": { "Loan object" }
}
```

**Errors:** 400 (KYC required, credit score, wallet missing)

---

### GET /loan/:id
Get loan by ID. **Protected.** User can only access own loans.

**Response (200):**
```json
{
  "success": true,
  "data": { "Loan object" }
}
```

**Errors:** 403 (unauthorized), 404 (not found)

---

### GET /loan/user/:userId
Get loans for user. **Protected.** Admin can access any user.

**Response (200):**
```json
{
  "success": true,
  "data": [ { "Loan objects" } ]
}
```

---

### POST /loan/approve
Approve loan. **Protected, Admin only.**

**Request Body:**
```json
{
  "loanId": "number (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "loanId": number,
    "txHash": "string"
  }
}
```

---

### POST /loan/repay
Record repayment (after user repays via MetaMask). **Protected.**

**Request Body:**
```json
{
  "loanId": "number (required)",
  "txHash": "string (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "Loan object" }
}
```

**Errors:** 400 (not repaid on blockchain yet)

---

## Credit Score Endpoints

### GET /credit-score
Get current user credit score. **Protected.**

**Response (200):**
```json
{
  "success": true,
  "data": { "creditScore": number }
}
```

---

### POST /credit-score/update
Recalculate and sync credit score to blockchain. **Protected.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "score": number,
    "txHash": "string | null"
  }
}
```

---

### PUT /credit-score/income
Update user income. **Protected.**

**Request Body:**
```json
{
  "income": "number (required, >= 0)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": { "income": number }
}
```

---

## Error Response Format

```json
{
  "success": false,
  "message": "Error description"
}
```
