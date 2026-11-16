import { APP_NAME } from '@chillops/shared';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

document.title = APP_NAME;

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');

createRoot(root).render(<StrictMode>{null}</StrictMode>);
