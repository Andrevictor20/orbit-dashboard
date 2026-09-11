import { Navigate } from 'react-router-dom';

/**
 * ComposeEditor page has been unified into the App Store custom install modal.
 * This route component redirects cleanly to /store?custom=true.
 */
export default function ComposeEditor() {
  return <Navigate to="/store?custom=true" replace />;
}
