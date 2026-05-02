delete from questions;

insert into questions (text, category, option_a, option_b, option_c, option_d, day_number, order_in_day)
values
  -- DAY 1
  ('When you face a problem you cannot solve immediately, you usually...', 'mindset',
   'Step back and think it through alone', 'Talk it out with someone you trust', 'Look for a workaround and keep moving', 'Accept it and wait for clarity', 1, 1),

  ('When someone close to you is upset, your first instinct is to...', 'emotional',
   'Listen without saying much', 'Try to fix the situation', 'Give them space until they are ready', 'Share a similar experience to relate', 1, 2),

  ('Your ideal way to spend a free Sunday is...', 'lifestyle',
   'Quiet and unplanned - whatever feels right', 'Out somewhere - coffee, walk, people', 'Catching up on something you have been putting off', 'Something new you have not tried before', 1, 3),

  ('When you get unexpected money, your instinct is to...', 'money',
   'Save it without thinking twice', 'Spend part of it on something you have wanted', 'Invest or do something productive with it', 'Share it or use it on others', 1, 4),

  ('Your mornings usually look like...', 'habits',
   'Slow and intentional - you ease in', 'Rushed but you always manage', 'Structured - same routine every day', 'Different every day depending on mood', 1, 5),

  ('In a relationship, what would make you feel most valued?', 'relationship',
   'Someone who listens deeply and remembers things', 'Someone who shows up when things get hard', 'Someone who pushes you to be better', 'Someone who makes ordinary moments fun', 1, 6),

  -- DAY 2
  ('When you disagree with someone you respect, you...', 'mindset',
   'Say what you think directly but calmly', 'Ask questions instead of stating your view', 'Let it go unless it really matters', 'Think it through privately before responding', 2, 1),

  ('When you are stressed, the thing that actually helps is...', 'emotional',
   'Being alone and quiet', 'Talking to someone who gets it', 'Physical movement - walk, gym, anything', 'Distracting yourself until it passes', 2, 2),

  ('How do you feel about last-minute plans?', 'lifestyle',
   'Love them - spontaneity is exciting', 'Fine with them occasionally', 'Prefer some notice but can adapt', 'Dislike them - you need time to prepare', 2, 3),

  ('What does financial security mean to you?', 'money',
   'Having enough saved to handle anything unexpected', 'Being able to afford experiences without guilt', 'Building something that grows over time', 'Not having to think about money much at all', 2, 4),

  ('When you want to improve at something, you...', 'habits',
   'Study it systematically and build a plan', 'Jump in and figure it out as you go', 'Find someone who already does it well', 'Practice quietly until you feel ready to show it', 2, 5),

  ('How do you handle conflict in a close relationship?', 'relationship',
   'Address it directly as soon as possible', 'Wait until emotions settle then talk', 'Try to understand their side first', 'Prefer to move past it without making it a big deal', 2, 6),

  -- DAY 3
  ('The version of success you actually want looks like...', 'mindset',
   'Freedom to live on your own terms', 'Deep relationships and people who matter', 'Building something that lasts beyond you', 'Constant growth and becoming more capable', 3, 1),

  ('When life feels uncertain, you tend to...', 'emotional',
   'Focus on what you can control and act', 'Lean on people close to you', 'Get quiet and process internally', 'Distract yourself and let time sort it out', 3, 2),

  ('Which feels most like you at your best?', 'lifestyle',
   'Calm, focused, and in flow', 'Social, energized, and connected', 'Productive, organized, and ahead', 'Curious, exploring, and learning', 3, 3),

  ('When it comes to big financial decisions, you...', 'money',
   'Research carefully before committing', 'Trust your gut if it feels right', 'Talk it through with people you trust', 'Go slowly and revisit it multiple times', 3, 4),

  ('How honest are you with yourself about your own flaws?', 'habits',
   'Very - self-awareness is something you actively work on', 'Mostly - you see them but do not always act on them', 'Sometimes - it depends on the flaw', 'It is hard - you tend to justify your behavior', 3, 5),

  ('What you actually need from a partner, if you are honest, is...', 'relationship',
   'Someone steady who makes you feel safe', 'Someone ambitious who challenges you', 'Someone warm who makes life feel lighter', 'Someone deep who understands you without explaining', 3, 6);
