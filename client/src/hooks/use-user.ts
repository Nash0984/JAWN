/**
 * Compatibility wrapper for useAuth
 * Re-exports useAuth as useUser for components that haven't been migrated
 */
export { useAuth as useUser } from "./useAuth";
