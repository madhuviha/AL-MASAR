import LoadingStatus from './LoadingStatus.jsx';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from './AppErrorBoundary.jsx';
import './styles.css';
import "./fleet-design.css";
import './modern-login.css';
createRoot(document.getElementById('root')).render(<React.StrictMode><AppErrorBoundary portal="company"><App/><LoadingStatus/></AppErrorBoundary></React.StrictMode>);
