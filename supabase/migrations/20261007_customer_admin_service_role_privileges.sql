-- Allow the admin-customers Edge Function to read and update customer records.
-- This function authenticates the caller separately and uses the service_role key only server-side.
grant select, update on public.customers to service_role;
