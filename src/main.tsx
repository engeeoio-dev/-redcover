import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installGlobalErrorMonitoring } from './services/firebase/globalErrorMonitoring';

installGlobalErrorMonitoring();
createRoot(document.getElementById('root')!).render(<App />);
