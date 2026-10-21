import LoadingStatus from './LoadingStatus.jsx';
import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import AppErrorBoundary from '../../../company-admin/frontend/src/AppErrorBoundary.jsx';
import '../../../company-admin/frontend/src/fleet-design.css';
import './styles.css';
import '../../../company-admin/frontend/src/modern-login.css';

createRoot(document.getElementById('root')).render(<AppErrorBoundary portal="super-admin"><App/><LoadingStatus/></AppErrorBoundary>);
