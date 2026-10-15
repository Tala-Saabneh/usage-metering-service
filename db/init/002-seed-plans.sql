INSERT INTO public.plans (
    name,
    plan_type,
    monthly_allowance,
    max_units_per_request,
    is_predefined,
    owner_account_id
)
SELECT
    seed.name,
    seed.plan_type,
    seed.monthly_allowance,
    seed.max_units_per_request,
    true,
    NULL
FROM (
    VALUES
        ('Pro', 'account', 10000, 500),
        ('Starter', 'account', 1000, 100),
        ('Basic', 'user', 100, 20),
        ('Premium', 'user', 1000, 100)
) AS seed(name, plan_type, monthly_allowance, max_units_per_request)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.plans existing
    WHERE existing.name = seed.name
      AND existing.plan_type = seed.plan_type
      AND existing.is_predefined = true
);
