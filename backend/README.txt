INVIHA TRACK BACKEND - VEHICLE/COMPANY API

This backend is designed to run only on the VPS and keep Traccar credentials server-side.
Do not put TRACCAR_ADMIN_PASSWORD into React/Vite frontend code.

Important: DATABASE_URL in .env assumes a PostgreSQL port mapped to 127.0.0.1:5433 for the app DB.
If you use the existing Docker PostgreSQL only internally, adjust the deployment steps accordingly.
