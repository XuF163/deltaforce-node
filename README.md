# Delta Force API (Node.js Rewrite)

This project is a Node.js rewrite of the original Delta Force PHP API.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1.  Clone the repository.
2.  Navigate to the `deltaforce-node` directory.
3.  Install the dependencies:
    ```bash
    npm install
    ```

### Running the Application

```bash
npm start
```

The server will start on `http://localhost:3000`.

## API Endpoints

All endpoints are prefixed with `/api`.

### QQ Login

-   **POST /qq/sig**
    -   **Description:** Get QR code for QQ login.
    -   **Response:**
        ```json
        {
          "code": 0,
          "message": "获取成功",
          "data": {
            "qrSig": "...",
            "image": "base64_encoded_image",
            "token": 123456789,
            "loginSig": "...",
            "cookie": { ... }
          }
        }
        ```

-   **POST /qq/status**
    -   **Description:** Check the status of the QR code scan.
    -   **Body:**
        ```json
        {
          "qrToken": 123456789,
          "qrSig": "...",
          "cookie": { ... }
        }
        ```
    -   **Response (Success):**
        ```json
        {
          "code": 0,
          "message": "登录成功",
          "data": {
            "cookie": { ... }
          }
        }
        ```

-   **POST /qq/access**
    -   **Description:** Get access token using the cookie from a successful login.
    -   **Body:**
        ```json
        {
          "cookie": { ... }
        }
        ```
    -   **Response:**
        ```json
        {
          "code": 0,
          "message": "获取成功",
          "data": {
            "access_token": "...",
            "expires_in": 7776000,
            "openid": "..."
          }
        }
        ```

### Game Data

-   **POST /game/record**
    -   **Description:** Get game record.
    -   **Body:**
        ```json
        {
          "openid": "...",
          "access_token": "..."
        }
        ```

-   **POST /game/player**
    -   **Description:** Get player data.
    -   **Body:**
        ```json
        {
          "openid": "...",
          "access_token": "..."
        }