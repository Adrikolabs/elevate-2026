-- DEMO / SEED DATA (is_demo = true). Safe to remove: DELETE FROM public.students WHERE is_demo;
INSERT INTO public.students (student_code, full_name, email, department_id, bio, is_nominee, is_demo)
SELECT v.code, v.name, v.email, d.id, v.bio, true, true
FROM (VALUES
  ('EA-WD-001','Alice Johnson','alice.johnson@demo.elevate.test','website-development','Front-end developer who loves crafting accessible, fast interfaces.'),
  ('EA-WD-002','Brian Kamau','brian.kamau@demo.elevate.test','website-development','Full-stack builder focused on e-commerce and booking systems.'),
  ('EA-WD-003','Christine Achieng','christine.achieng@demo.elevate.test','website-development','Designer-developer bridging UX research and clean code.'),
  ('EA-GD-001','David Mensah','david.mensah@demo.elevate.test','graphics-design','Brand identity designer with a passion for bold typography.'),
  ('EA-GD-002','Esther Njeri','esther.njeri@demo.elevate.test','graphics-design','Illustrator and packaging designer inspired by African patterns.'),
  ('EA-GD-003','Faith Mwangi','faith.mwangi@demo.elevate.test','graphics-design','Editorial and social media designer telling stories visually.'),
  ('EA-FP-001','Grace Otieno','grace.otieno@demo.elevate.test','film-photography','Documentary filmmaker capturing everyday heroes.'),
  ('EA-FP-002','Hassan Ali','hassan.ali@demo.elevate.test','film-photography','Portrait and street photographer with a cinematic eye.'),
  ('EA-FP-003','Ivy Wanjiku','ivy.wanjiku@demo.elevate.test','film-photography','Music video director and colourist.'),
  ('EA-VA-001','Joy Atieno','joy.atieno@demo.elevate.test','virtual-assistant','Executive assistant specialising in calendar and inbox systems.'),
  ('EA-VA-002','Kevin Omondi','kevin.omondi@demo.elevate.test','virtual-assistant','Customer support lead who automates repetitive workflows.'),
  ('EA-VA-003','Lilian Chebet','lilian.chebet@demo.elevate.test','virtual-assistant','Social media manager and content scheduler.'),
  ('EA-MG-001','Mark Kiprono','mark.kiprono@demo.elevate.test','motion-graphics','3D motion designer creating playful product animations.'),
  ('EA-MG-002','Naomi Wairimu','naomi.wairimu@demo.elevate.test','motion-graphics','Kinetic typography and explainer video animator.'),
  ('EA-MG-003','Oscar Mutua','oscar.mutua@demo.elevate.test','motion-graphics','Title sequence designer inspired by film noir.'),
  ('EA-CS-001','Peter Njoroge','peter.njoroge@demo.elevate.test','computer-science','Problem solver who enjoys algorithms and data structures.'),
  ('EA-CS-002','Rose Akinyi','rose.akinyi@demo.elevate.test','computer-science','Python enthusiast building tools for local farmers.'),
  ('EA-CS-003','Samuel Odhiambo','samuel.odhiambo@demo.elevate.test','computer-science','Curious learner exploring databases and automation.')
) AS v(code, name, email, slug, bio)
JOIN public.departments d ON d.slug = v.slug;

INSERT INTO public.projects (student_id, department_id, title, description, cover_image_url, project_type, project_url, is_featured, is_published)
SELECT s.id, s.department_id, v.title, v.descr, v.cover, v.ptype, v.url, v.featured, true
FROM (VALUES
  ('EA-WD-001','Savannah Analytics Dashboard','A responsive analytics dashboard for small businesses with live charts and dark mode.','/__l5e/assets-v1/2639fe00-fabc-40ee-86ca-4bd82a0699f7/cover-web.jpg','Website','https://example.com',true),
  ('EA-WD-002','Safari Booking Platform','End-to-end booking flow for tour operators with payments and itinerary builder.','/__l5e/assets-v1/2639fe00-fabc-40ee-86ca-4bd82a0699f7/cover-web.jpg','Website','https://example.com',false),
  ('EA-WD-003','Community Clinic Portal','Appointment scheduling portal designed with patients and nurses.','/__l5e/assets-v1/2639fe00-fabc-40ee-86ca-4bd82a0699f7/cover-web.jpg','Figma Project','https://figma.com',false),
  ('EA-GD-001','Kahawa Coffee Rebrand','Complete identity system for a Nairobi coffee roaster: logo, packaging and signage.','/__l5e/assets-v1/53832b74-2f0e-4e7f-a618-e2c9a34d6d6f/cover-graphics.jpg','Graphic Design','https://behance.net',true),
  ('EA-GD-002','Bloom Botanicals Packaging','Eco-friendly packaging series with hand-drawn botanical illustration.','/__l5e/assets-v1/53832b74-2f0e-4e7f-a618-e2c9a34d6d6f/cover-graphics.jpg','Behance Project','https://behance.net',false),
  ('EA-GD-003','City Arts Festival Posters','Poster campaign for a city arts festival using bold grid layouts.','/__l5e/assets-v1/53832b74-2f0e-4e7f-a618-e2c9a34d6d6f/cover-graphics.jpg','Graphic Design',NULL,false),
  ('EA-FP-001','Golden Hour: A Short Documentary','A 12-minute documentary following street vendors from dawn to dusk.','/__l5e/assets-v1/2a19be86-72e5-4428-898b-fe4eae5a4703/cover-film.jpg','Video','https://www.youtube.com/watch?v=dQw4w9WgXcQ',true),
  ('EA-FP-002','Faces of the City','A portrait photography series celebrating local craftspeople.','/__l5e/assets-v1/2a19be86-72e5-4428-898b-fe4eae5a4703/cover-film.jpg','Photography',NULL,false),
  ('EA-FP-003','Rhythm – Music Video','Music video production for an emerging Afro-pop artist.','/__l5e/assets-v1/2a19be86-72e5-4428-898b-fe4eae5a4703/cover-film.jpg','Video','https://vimeo.com/76979871',false),
  ('EA-VA-001','Executive Inbox System','A documented inbox-zero and calendar management system for busy founders.','/__l5e/assets-v1/a1326348-b61e-46ce-aef5-7ea8abdeed61/cover-va.jpg','PDF',NULL,true),
  ('EA-VA-002','Support Automation Playbook','Templates and automations that cut customer response time in half.','/__l5e/assets-v1/a1326348-b61e-46ce-aef5-7ea8abdeed61/cover-va.jpg','Other',NULL,false),
  ('EA-VA-003','30-Day Content Calendar','A social media content strategy and scheduling plan for a local bakery.','/__l5e/assets-v1/a1326348-b61e-46ce-aef5-7ea8abdeed61/cover-va.jpg','Other',NULL,false),
  ('EA-MG-001','Liquid Gold Product Reveal','A 3D product reveal animation with flowing ribbons and reflective materials.','/__l5e/assets-v1/32a688bf-f462-49e1-b5a0-5c0d0f0b0550/cover-motion.jpg','Motion Graphics','https://vimeo.com/76979871',true),
  ('EA-MG-002','Explain It Simply','Animated explainer series introducing mobile money to first-time users.','/__l5e/assets-v1/32a688bf-f462-49e1-b5a0-5c0d0f0b0550/cover-motion.jpg','Motion Graphics',NULL,false),
  ('EA-MG-003','Nightfall Title Sequence','Opening title sequence concept for a mystery drama series.','/__l5e/assets-v1/32a688bf-f462-49e1-b5a0-5c0d0f0b0550/cover-motion.jpg','Video',NULL,false),
  ('EA-CS-001','Pathfinder Visualiser','Interactive visualiser for shortest-path algorithms on a grid.','/__l5e/assets-v1/de99c1f2-8eda-48b0-afdb-63550a283b79/cover-cs.jpg','GitHub Project','https://github.com',true),
  ('EA-CS-002','Shamba Price Tracker','A Python tool that tracks and charts local crop market prices.','/__l5e/assets-v1/de99c1f2-8eda-48b0-afdb-63550a283b79/cover-cs.jpg','GitHub Project','https://github.com',false),
  ('EA-CS-003','Library Inventory System','A simple database-backed inventory system for a school library.','/__l5e/assets-v1/de99c1f2-8eda-48b0-afdb-63550a283b79/cover-cs.jpg','GitHub Project','https://github.com',false)
) AS v(code, title, descr, cover, ptype, url, featured)
JOIN public.students s ON s.student_code = v.code;

INSERT INTO public.graduation_messages (student_id, message, created_at)
SELECT s.id, v.msg, now() - (v.mins || ' minutes')::interval
FROM (VALUES
  ('EA-WD-001','So proud of every single one of us. Class of December 2026, we made it! 🎓', 300),
  ('EA-GD-002','Thank you to our amazing mentors for believing in us from day one. ✨', 240),
  ('EA-FP-001','Every late night editing session was worth it. Congratulations everyone! 🎬', 180),
  ('EA-VA-003','Here''s to new beginnings and the next chapter. Keep elevating! 🚀', 120),
  ('EA-MG-001','From our first keyframe to our final reel — what a journey. 💛', 60),
  ('EA-CS-002','print("Congratulations, Class of 2026!") 🎉', 30)
) AS v(code, msg, mins)
JOIN public.students s ON s.student_code = v.code;