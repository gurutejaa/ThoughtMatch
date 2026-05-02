insert into batches (status, start_date, registration_closes_at)
select 'active', current_date, now() + interval '2 days'
where not exists (
  select 1 from batches where status = 'active'
);

insert into questions (text, category, option_a, option_b, option_c, option_d, day_number, order_in_day)
select *
from (
  values
    ('When something goes wrong, your first instinct is to…', 'emotional', 'Stay calm and think it through', 'Talk to someone about it', 'Fix it immediately', 'Step away and cool down', 1, 1),
    ('Your ideal weekend looks like…', 'lifestyle', 'Quiet time at home', 'Out with close friends', 'Exploring something new', 'Productive on personal goals', 1, 2),
    ('When making a big decision, you mostly trust…', 'mindset', 'Logic and data', 'Your gut feeling', 'Advice from people you trust', 'Whatever feels right in the moment', 2, 1),
    ('Money is mainly a tool for…', 'money', 'Security and stability', 'Experiences and enjoyment', 'Building something bigger', 'Helping others', 2, 2),
    ('In a relationship, what matters most to you?', 'relationship', 'Deep emotional understanding', 'Shared goals and ambition', 'Fun and spontaneity', 'Loyalty and consistency', 3, 1),
    ('How do you usually grow as a person?', 'habits', 'Reading and learning alone', 'Through challenges and failure', 'Watching people around you', 'Reflection and journaling', 3, 2)
) as seed(text, category, option_a, option_b, option_c, option_d, day_number, order_in_day)
where not exists (
  select 1
  from questions q
  where q.day_number = seed.day_number
    and q.order_in_day = seed.order_in_day
);
