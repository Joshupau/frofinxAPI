-- Native Postgres enums, one per Mongoose field that declared a closed
-- `enum: [...]` list. Fields that were undeclared/admin-editable in Mongoose
-- (profiles.status, staff_users.status/role, maintenance.type,
-- global_pass_usage.user_type) stay plain `text` in their table migrations.

create type wallet_type as enum ('bank', 'cash', 'ewallet', 'credit_card', 'other');
create type record_status as enum ('active', 'archived');

create type category_type as enum ('income', 'expense');

create type transaction_type as enum ('income', 'expense', 'transfer');
create type transaction_status as enum ('completed', 'pending', 'cancelled');

create type bill_type as enum ('bill', 'income');
create type recurring_frequency as enum ('daily', 'weekly', 'monthly', 'yearly');
create type bill_payment_status as enum ('paid', 'unpaid', 'overdue', 'partial', 'received');

create type budget_period as enum ('daily', 'weekly', 'monthly', 'yearly');
create type budget_status as enum ('active', 'exceeded', 'archived');

create type obligation_direction as enum ('debt', 'lending');
create type interest_type as enum ('simple', 'compound');
create type obligation_status as enum ('active', 'partially_paid', 'settled', 'defaulted', 'archived');
create type installment_frequency as enum ('weekly', 'monthly', 'yearly');

create type investment_type as enum ('stocks', 'bonds', 'mutual_funds', 'crypto', 'real_estate', 'savings', 'other');
create type investment_status as enum ('active', 'matured', 'sold', 'archived');
