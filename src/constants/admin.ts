const configuredAdminEmail = import.meta.env.VITE_ADMIN_EMAIL?.trim();

if (!configuredAdminEmail) {
  console.warn(
    'VITE_ADMIN_EMAIL is not set; falling back to the default administrator address. ' +
      'Set this variable in your .env file to override.',
  );
}

export const ADMIN_EMAIL = configuredAdminEmail || 'zeraielyes@gmail.com';
