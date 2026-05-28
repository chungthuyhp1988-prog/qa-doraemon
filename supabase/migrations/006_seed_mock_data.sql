-- ============================================================================
-- Doraemon Kindergarten Management System – Seed Mock Data
-- Migration: 006_seed_mock_data.sql
-- Created:   2026-05-28
--
-- Bổ sung bộ dữ liệu mẫu cho điểm danh, dinh dưỡng, sức khỏe, đánh giá
-- ============================================================================

-- 1. Điểm danh (Attendance) cho 5 ngày gần nhất (2026-05-25 đến 2026-05-29)
DO $$
DECLARE
  student_rec RECORD;
  date_rec DATE;
  dates DATE[] := ARRAY['2026-05-25'::DATE, '2026-05-26'::DATE, '2026-05-27'::DATE, '2026-05-28'::DATE, '2026-05-29'::DATE];
  rand_val NUMERIC;
  att_status attendance_status;
  c_in TIME;
  c_out TIME;
  admin_id UUID;
BEGIN
  -- Lấy ID của một quản trị viên làm người ghi nhận
  SELECT id INTO admin_id FROM public.users WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM public.users LIMIT 1;
  END IF;

  FOR student_rec IN SELECT id, class_id FROM public.students WHERE status = 'active' AND class_id IS NOT NULL LOOP
    FOREACH date_rec IN ARRAY dates LOOP
      -- Chỉ tạo điểm danh nếu chưa có bản ghi
      IF NOT EXISTS (SELECT 1 FROM public.attendance WHERE student_id = student_rec.id AND date = date_rec) THEN
        rand_val := random();
        IF rand_val < 0.90 THEN
          att_status := 'present'::attendance_status;
          c_in := '07:30:00'::TIME + (random() * 25 * '1 minute'::INTERVAL); -- 07:30 - 07:55
          c_out := '16:15:00'::TIME + (random() * 35 * '1 minute'::INTERVAL); -- 16:15 - 16:50
        ELSIF rand_val < 0.95 THEN
          att_status := 'late'::attendance_status;
          c_in := '08:05:00'::TIME + (random() * 25 * '1 minute'::INTERVAL); -- 08:05 - 08:30
          c_out := '16:30:00'::TIME;
        ELSIF rand_val < 0.98 THEN
          att_status := 'sick'::attendance_status;
          c_in := NULL;
          c_out := NULL;
        ELSE
          att_status := 'absent'::attendance_status;
          c_in := NULL;
          c_out := NULL;
        END IF;

        INSERT INTO public.attendance (student_id, class_id, date, status, check_in_time, check_out_time, recorded_by, note)
        VALUES (
          student_rec.id, 
          student_rec.class_id, 
          date_rec, 
          att_status, 
          c_in, 
          c_out, 
          admin_id, 
          CASE 
            WHEN att_status = 'sick' THEN 'Bé bị sốt, phụ huynh xin nghỉ'
            WHEN att_status = 'absent' THEN 'Nghỉ phép việc gia đình'
            WHEN att_status = 'late' THEN 'Trễ giờ đón'
            ELSE NULL 
          END
        );
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 2. Sức khỏe (Health Records) - 2 đợt (Khám đầu năm 09/2025 và Giữa năm 03/2026)
DO $$
DECLARE
  student_rec RECORD;
  admin_id UUID;
  birth_year INT;
  age INT;
  h NUMERIC(5,1);
  w NUMERIC(5,1);
  temp NUMERIC(4,1);
  blood_types VARCHAR[] := ARRAY['A', 'B', 'O', 'AB'];
  blood_type VARCHAR(5);
  health_status TEXT;
  rec_date DATE;
BEGIN
  -- Lấy ID người ghi nhận
  SELECT id INTO admin_id FROM public.users WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM public.users LIMIT 1;
  END IF;

  FOR student_rec IN SELECT id, date_of_birth FROM public.students WHERE status = 'active' LOOP
    birth_year := EXTRACT(YEAR FROM student_rec.date_of_birth);
    blood_type := blood_types[1 + floor(random() * 4)::INT];

    -- Đợt 1: 15/09/2025
    rec_date := '2025-09-15'::DATE;
    IF NOT EXISTS (SELECT 1 FROM public.health_records WHERE student_id = student_rec.id AND record_date = rec_date) THEN
      age := 2025 - birth_year;
      IF age <= 2 THEN
        h := 82.0 + (random() * 8.0);
        w := 10.5 + (random() * 3.5);
      ELSIF age = 3 THEN
        h := 90.0 + (random() * 9.0);
        w := 12.0 + (random() * 4.0);
      ELSIF age = 4 THEN
        h := 98.0 + (random() * 9.0);
        w := 14.0 + (random() * 5.0);
      ELSIF age = 5 THEN
        h := 104.0 + (random() * 10.0);
        w := 16.0 + (random() * 5.0);
      ELSE
        h := 110.0 + (random() * 10.0);
        w := 18.0 + (random() * 6.0);
      END IF;

      temp := 36.3 + (random() * 0.5);
      health_status := CASE WHEN random() < 0.90 THEN 'Bình thường, thể trạng tốt' ELSE 'Cân nặng hơi nhẹ so với chiều cao, cần theo dõi' END;

      INSERT INTO public.health_records (student_id, record_date, height_cm, weight_kg, temperature, blood_type, health_status, vaccination_info, notes, recorded_by)
      VALUES (student_rec.id, rec_date, round(h, 1), round(w, 1), round(temp, 1), blood_type, health_status, 'Đã tiêm chủng đầy đủ theo độ tuổi', 'Khám sức khỏe định kỳ đầu năm học 2025-2026', admin_id);
    END IF;

    -- Đợt 2: 15/03/2026 (sau 6 tháng)
    rec_date := '2026-03-15'::DATE;
    IF NOT EXISTS (SELECT 1 FROM public.health_records WHERE student_id = student_rec.id AND record_date = rec_date) THEN
      age := 2026 - birth_year;
      -- Lấy chiều cao/cân nặng cũ đợt 1 nếu có để tăng lên một cách logic
      SELECT height_cm, weight_kg INTO h, w FROM public.health_records WHERE student_id = student_rec.id AND record_date = '2025-09-15' LIMIT 1;
      
      IF h IS NULL THEN
        IF age <= 2 THEN
          h := 84.0 + (random() * 8.0);
          w := 11.5 + (random() * 3.5);
        ELSIF age = 3 THEN
          h := 92.0 + (random() * 9.0);
          w := 13.0 + (random() * 4.0);
        ELSIF age = 4 THEN
          h := 100.0 + (random() * 9.0);
          w := 15.0 + (random() * 5.0);
        ELSIF age = 5 THEN
          h := 106.0 + (random() * 10.0);
          w := 17.0 + (random() * 5.0);
        ELSE
          h := 112.0 + (random() * 10.0);
          w := 19.0 + (random() * 6.0);
        END IF;
      ELSE
        h := h + 2.0 + (random() * 2.0); -- Tăng 2 - 4 cm
        w := w + 0.8 + (random() * 1.5); -- Tăng 0.8 - 2.3 kg
      END IF;

      temp := 36.3 + (random() * 0.5);
      health_status := CASE WHEN random() < 0.92 THEN 'Bình thường, thể trạng tốt' ELSE 'Cân nặng hơi nhẹ so với chiều cao, cần theo dõi' END;

      INSERT INTO public.health_records (student_id, record_date, height_cm, weight_kg, temperature, blood_type, health_status, vaccination_info, notes, recorded_by)
      VALUES (student_rec.id, rec_date, round(h, 1), round(w, 1), round(temp, 1), blood_type, health_status, 'Đã tiêm chủng đầy đủ theo độ tuổi', 'Khám sức khỏe định kỳ học kỳ II', admin_id);
    END IF;
  END LOOP;
END $$;

-- 3. Dinh dưỡng (Meal Plans) - Thực đơn toàn trường cho tuần từ 25/05/2026 đến 29/05/2026
DO $$
DECLARE
  school_id UUID := '00000000-0000-0000-0000-000000000001';
  admin_id UUID;
  plan_exists BOOLEAN;
BEGIN
  -- Lấy ID người tạo
  SELECT id INTO admin_id FROM public.users WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM public.users LIMIT 1;
  END IF;

  -- Thứ Hai 25/05/2026
  SELECT EXISTS(SELECT 1 FROM public.meal_plans WHERE date = '2026-05-25' AND class_id IS NULL) INTO plan_exists;
  IF NOT plan_exists THEN
    INSERT INTO public.meal_plans (school_id, class_id, date, meal_type, menu_items, calories, notes, created_by) VALUES
      (school_id, NULL, '2026-05-25', 'breakfast', 'Cháo gà hạt sen, sữa chua TH True Milk', 280, 'Thức ăn mềm dẻo, dễ tiêu hóa', admin_id),
      (school_id, NULL, '2026-05-25', 'lunch', 'Cơm tám thơm, tôm rim bơ tỏi, thịt viên sốt cà chua, canh bí đao nấu thịt băm, chuối chín', 490, 'Thực đơn giàu đạm và canxi', admin_id),
      (school_id, NULL, '2026-05-25', 'afternoon_snack', 'Bánh bông lan cuộn kem, sữa đậu nành hạt sen', 180, 'Bữa phụ nhẹ ngọt ngào', admin_id);
  END IF;

  -- Thứ Ba 26/05/2026
  SELECT EXISTS(SELECT 1 FROM public.meal_plans WHERE date = '2026-05-26' AND class_id IS NULL) INTO plan_exists;
  IF NOT plan_exists THEN
    INSERT INTO public.meal_plans (school_id, class_id, date, meal_type, menu_items, calories, notes, created_by) VALUES
      (school_id, NULL, '2026-05-26', 'breakfast', 'Phở bò xé phay, nước ép dưa hấu tươi', 310, 'Phở bò chín mềm, nước dùng hầm xương', admin_id),
      (school_id, NULL, '2026-05-26', 'lunch', 'Cơm tám thơm, trứng cuộn ngũ sắc, thịt bò xào súp lơ xanh, canh rau cải ngọt nấu tôm, đu đủ chín', 505, 'Bổ sung chất xơ và vitamin nhóm B', admin_id),
      (school_id, NULL, '2026-05-26', 'afternoon_snack', 'Bánh flan caramen, sữa hạt macca', 190, 'Bánh mềm ngậy bé rất thích', admin_id);
  END IF;

  -- Thứ Tư 27/05/2026
  SELECT EXISTS(SELECT 1 FROM public.meal_plans WHERE date = '2026-05-27' AND class_id IS NULL) INTO plan_exists;
  IF NOT plan_exists THEN
    INSERT INTO public.meal_plans (school_id, class_id, date, meal_type, menu_items, calories, notes, created_by) VALUES
      (school_id, NULL, '2026-05-27', 'breakfast', 'Cháo cá lóc nấu rau mồng tơi, sữa hạt óc chó', 290, 'Cá quả được lọc kỹ xương dăm', admin_id),
      (school_id, NULL, '2026-05-27', 'lunch', 'Cơm tám thơm, đùi gà sốt mật ong, sườn non xào chua ngọt, canh củ quả thập cẩm sườn heo, cam sành ngọt', 515, 'Tránh gia vị cay nóng', admin_id),
      (school_id, NULL, '2026-05-27', 'afternoon_snack', 'Chè hạt sen đậu xanh nước cốt dừa, bánh quy bơ ngọt', 195, 'Bữa phụ thanh mát giải nhiệt mùa hè', admin_id);
  END IF;

  -- Thứ Năm 28/05/2026
  SELECT EXISTS(SELECT 1 FROM public.meal_plans WHERE date = '2026-05-28' AND class_id IS NULL) INTO plan_exists;
  IF NOT plan_exists THEN
    INSERT INTO public.meal_plans (school_id, class_id, date, meal_type, menu_items, calories, notes, created_by) VALUES
      (school_id, NULL, '2026-05-28', 'breakfast', 'Súp cua bể bí đỏ, bánh mì gối nướng bơ sữa', 275, 'Súp cua bể sánh mịn ngọt thanh', admin_id),
      (school_id, NULL, '2026-05-28', 'lunch', 'Cơm tám thơm, thịt heo kho tộ, trứng vịt om nước dừa, canh cải cúc nấu thịt băm, quả nho ngọt', 495, 'Dinh dưỡng cân đối chất béo tốt', admin_id),
      (school_id, NULL, '2026-05-28', 'afternoon_snack', 'Sữa chua nha đam Vinamilk, bánh muffin chuối', 170, 'Bổ sung lợi khuẩn tiêu hóa', admin_id);
  END IF;

  -- Thứ Sáu 29/05/2026
  SELECT EXISTS(SELECT 1 FROM public.meal_plans WHERE date = '2026-05-29' AND class_id IS NULL) INTO plan_exists;
  IF NOT plan_exists THEN
    INSERT INTO public.meal_plans (school_id, class_id, date, meal_type, menu_items, calories, notes, created_by) VALUES
      (school_id, NULL, '2026-05-29', 'breakfast', 'Xôi xéo mỡ hành chả lụa heo, sữa tươi tiệt trùng', 325, 'Xôi dẻo thơm ngậy', admin_id),
      (school_id, NULL, '2026-05-29', 'lunch', 'Cơm tám thơm, cá thu sốt cà chua, thịt bò xào hành tây, canh rau ngót nấu thịt băm, xoài cát chín', 530, 'Cá biển dồi dào DHA phát triển trí não', admin_id),
      (school_id, NULL, '2026-05-29', 'afternoon_snack', 'Bánh bao chay nhân đậu đỏ ngọt, sữa hạt sen thơm mát', 185, 'Bữa phụ ấm bụng ngày cuối tuần', admin_id);
  END IF;
END $$;

-- 4. Đánh giá học tập (Student Evaluations) - Đánh giá học kỳ / định kỳ (Tháng 5/2026)
DO $$
DECLARE
  student_rec RECORD;
  admin_id UUID;
  acad_year_id UUID := '00000000-0000-0000-0000-000000000002';
  p_score INT;
  c_score INT;
  l_score INT;
  s_score INT;
  a_score INT;
  eval_exists BOOLEAN;
BEGIN
  -- Lấy ID người đánh giá
  SELECT id INTO admin_id FROM public.users WHERE role = 'admin' LIMIT 1;
  IF admin_id IS NULL THEN
    SELECT id INTO admin_id FROM public.users LIMIT 1;
  END IF;

  FOR student_rec IN SELECT id FROM public.students WHERE status = 'active' LOOP
    SELECT EXISTS(SELECT 1 FROM public.student_evaluations WHERE student_id = student_rec.id AND period = 'Tháng 5') INTO eval_exists;
    IF NOT eval_exists THEN
      -- Điểm ngẫu nhiên phân bố từ 3 đến 5
      p_score := 3 + floor(random() * 3)::INT;
      c_score := 3 + floor(random() * 3)::INT;
      l_score := 3 + floor(random() * 3)::INT;
      s_score := 3 + floor(random() * 3)::INT;
      a_score := 3 + floor(random() * 3)::INT;

      INSERT INTO public.student_evaluations (
        student_id, evaluator_id, evaluation_date, period, academic_year_id,
        physical_score, physical_note,
        cognitive_score, cognitive_note,
        language_score, language_note,
        social_score, social_note,
        aesthetic_score, aesthetic_note,
        overall_comment, recommendation
      ) VALUES (
        student_rec.id, 
        admin_id, 
        '2026-05-25'::DATE, 
        'Tháng 5', 
        acad_year_id,
        p_score, 
        CASE p_score 
          WHEN 5 THEN 'Thể lực tốt, nhanh nhẹn, rất năng nổ tham gia các trò chơi vận động.'
          WHEN 4 THEN 'Khỏe mạnh, tham gia đầy đủ các bài tập thể dục buổi sáng và giờ học thể chất.'
          ELSE 'Thể trạng khỏe mạnh bình thường, đôi khi còn hơi rụt rè chưa tích cực chạy nhảy.'
        END,
        c_score,
        CASE c_score
          WHEN 5 THEN 'Nhận thức nhanh nhạy, tư duy tốt, có trí nhớ vượt trội về chữ cái và con số.'
          WHEN 4 THEN 'Nhận biết chính xác màu sắc, hình khối và làm quen với các khái niệm toán học đơn giản tốt.'
          ELSE 'Khả năng tập trung khá tốt, hoàn thành các nhiệm vụ cô giao theo yêu cầu.'
        END,
        l_score,
        CASE l_score
          WHEN 5 THEN 'Ngôn ngữ phong phú, diễn đạt câu dài mạch lạc trọn vẹn, tự tin kể chuyện sáng tạo.'
          WHEN 4 THEN 'Phát âm rõ ràng, diễn đạt đầy đủ ý muốn cho cô giáo và các bạn cùng hiểu.'
          ELSE 'Biết lắng nghe và làm theo chỉ dẫn, vốn từ đang ngày một tiến bộ.'
        END,
        s_score,
        CASE s_score
          WHEN 5 THEN 'Ngoan ngoãn, biết chia sẻ đồ chơi, hòa đồng và thích giúp đỡ bạn bè trong lớp.'
          WHEN 4 THEN 'Hòa nhập tốt với môi trường lớp học, biết kính trọng cô giáo và thân thiện với bạn.'
          ELSE 'Biết cư xử ngoan ngoãn lễ phép, đôi lúc cần chủ động bắt chuyện với bạn mới nhiều hơn.'
        END,
        a_score,
        CASE a_score
          WHEN 5 THEN 'Cảm thụ âm nhạc tốt, vẽ tranh tô màu sáng tạo và biết phối màu sắc sinh động.'
          WHEN 4 THEN 'Rất thích múa hát cùng cô và vẽ tranh, nặn đất sét khéo léo tỉ mỉ.'
          ELSE 'Yêu thích các hoạt động tạo hình và múa hát tập thể cùng các bạn.'
        END,
        'Bé ngoan ngoãn, lễ phép, học tập tiến bộ rõ rệt và hòa đồng tham gia các hoạt động ngoại khóa.',
        'Phụ huynh nên tiếp tục khuyến khích bé chia sẻ câu chuyện hàng ngày tại nhà và rèn thói quen tự lập.'
      );
    END IF;
  END LOOP;
END $$;
