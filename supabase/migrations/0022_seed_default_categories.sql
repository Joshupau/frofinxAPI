-- Ports fico-api/initialization/initialize.ts's default-categories seed
-- (fico-api/initialization/data/categories.json) to Supabase. The Mongo
-- backend seeded these global (owner_id null) categories on server startup;
-- there was no equivalent for the Supabase schema, so every user on the
-- Supabase backend saw zero categories (nothing for the categories list to
-- union in via RLS). config.toml points at a seed.sql that was never
-- created — a migration is used instead so this also applies to the
-- already-deployed production project via `supabase db push`, not just
-- local `db reset`. Guarded so re-running this migration file is a no-op.
do $$
begin
  if not exists (
    select 1 from public.categories where owner_id is null and is_default = true
  ) then
    insert into public.categories (owner_id, name, type, icon, color, is_default, status)
    values
      (null, 'Salary', 'income', '💰', '#4CAF50', true, 'active'),
      (null, 'Freelance', 'income', '💼', '#2196F3', true, 'active'),
      (null, 'Business', 'income', '🏢', '#FF9800', true, 'active'),
      (null, 'Investment', 'income', '📈', '#9C27B0', true, 'active'),
      (null, 'Remittance', 'income', '🌐', '#00BCD4', true, 'active'),
      (null, 'Gift', 'income', '🎁', '#E91E63', true, 'active'),
      (null, 'Other Income', 'income', '➕', '#607D8B', true, 'active'),
      (null, 'Food & Dining', 'expense', '🍽️', '#FF5722', true, 'active'),
      (null, 'Groceries', 'expense', '🛒', '#8BC34A', true, 'active'),
      (null, 'Transportation', 'expense', '🚗', '#FFC107', true, 'active'),
      (null, 'Bills & Utilities', 'expense', '⚡', '#FF9800', true, 'active'),
      (null, 'Rent', 'expense', '🏠', '#795548', true, 'active'),
      (null, 'Healthcare', 'expense', '🏥', '#F44336', true, 'active'),
      (null, 'Entertainment', 'expense', '🎬', '#9C27B0', true, 'active'),
      (null, 'Shopping', 'expense', '🛍️', '#E91E63', true, 'active'),
      (null, 'Education', 'expense', '📚', '#3F51B5', true, 'active'),
      (null, 'Insurance', 'expense', '🛡️', '#00BCD4', true, 'active'),
      (null, 'Clothing', 'expense', '👔', '#673AB7', true, 'active'),
      (null, 'Personal Care', 'expense', '💅', '#FF4081', true, 'active'),
      (null, 'Travel', 'expense', '✈️', '#2196F3', true, 'active'),
      (null, 'Subscription', 'expense', '📱', '#00BCD4', true, 'active'),
      (null, 'Donation', 'expense', '❤️', '#E91E63', true, 'active'),
      (null, 'Other Expense', 'expense', '➖', '#607D8B', true, 'active');
  end if;
end $$;
