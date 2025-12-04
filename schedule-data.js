const scheduleData = {
  "semester": {
    "type": "winter",
    "startDate": "2025-09-15",
    "endDate": "2025-12-23",
    "christmasBreak": {
      "start": "2025-12-24",
      "end": "2026-01-01"
    },
    "examPeriod": {
      "start": "2026-01-02",
      "end": "2026-02-14"
    }
  },
  
  // ИЗПИТИ - добави дати за изпити и поправки
  "exams": [
    {
      "subject": "Медицинска генетика",
      "fullName": "Медицинска генетика",
      "examDate": "2026-01-07",
      "examTime": "",
      "examLocation": "",
      "retakeDate": "2026-02-13",
      "retakeTime": "",
      "retakeLocation": ""
    },
    {
      "subject": "Фармакология",
      "fullName": "Фармакология",
      "examDate": "2026-01-12",
      "examTime": "",
      "examLocation": "",
      "retakeDate": "2026-02-09 и 2026-02-13",
      "retakeTime": "",
      "retakeLocation": ""
    },
     {
      "subject": "Клинична имунология",
      "fullName": "Клинична имунология",
      "examDate": "2026-01-15",
      "examTime": "",
      "examLocation": "",
      "retakeDate": "2026-02-13",
      "retakeTime": "",
      "retakeLocation": ""
    },
    
    {
      "subject": "Рентгенология, радиология",
      "fullName": "Рентгенология, радиология",
      "examDate": "2026-01-23",
      "examTime": "",
      "examLocation": "",
      "retakeDate": "2026-02-09 и 2026-02-13",
      "retakeTime": "",
      "retakeLocation": ""
    },
    {
      "subject": "Ушни, носни и гърлени болести",
      "fullName": "Ушни, носни и гърлени болести",
      "examDate": "2026-01-28",
      "examTime": "",
      "examLocation": "",
      "retakeDate": "2026-02-09",
      "retakeTime": "",
      "retakeLocation": ""
    }
   
  ],
  
  // ШАБЛОН - базово разписание, което се повтаря всяка седмица
  "template": [
    {
      "day": "ПОН",
      "subject": "фарм",
      "fullName": "Фармакология",
      "type": "Упражнение",
      "building": "Ректорат",
      "room": "307-1",
      "floor": 3,
      "teacher": "доц. д-р Силвия Ганчева Маринова, д.м.",
      "startTime": "07:15",
      "endTime": "09:30"
    },
    {
      "day": "ПОН",
      "subject": "ВБ1",
      "fullName": "Вътрешни Болести I част",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Клиника по Пневмология и Фтизиатрия",
      "floor": 10,
      "teacher": "проф. д-р Диана Петкова Господинова-Вълкова, д.м.",
      "startTime": "09:45",
      "endTime": "11:15"
    },
    {
      "day": "ПОН",
      "subject": "УНГ",
      "fullName": "Ушни, носни и гърлени болести",
      "type": "Важна лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Аудитория А",
      "floor": 2,
      "teacher": "",
      "startTime": "14:00",
      "endTime": "16:15"
    },
    {
      "day": "ПОН",
      "subject": "АГ",
      "fullName": "Акушерство и гинекология",
      "type": "Лекция",
      "building": "Медицински Колеж",
      "room": "Б",
      "floor": 4,
      "teacher": "доц. д-р Кремен Цветанов Цветков, д.м.",
      "startTime": "16:30",
      "endTime": "18:00"
    },
    {
      "day": "ВТ",
      "subject": "клпат",
      "fullName": "Клинична патология",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - Секционен блок",
      "room": "1",
      "floor": 1,
      "teacher": "гл. ас. д-р Доротея Василева Малинова, д.м.",
      "startTime": "08:00",
      "endTime": "09:30"
    },
    {
      "day": "ВТ",
      "subject": "АГ",
      "fullName": "Акушерство и гинекология",
      "type": "Упражнение",
      "building": "",
      "room": "",
      "floor": "",
      "teacher": "доц. д-р Живко Стоянов Жеков, д.м.",
      "startTime": "09:45",
      "endTime": "11:15"
    },
    {
      "day": "ВТ",
      "subject": "ХБ",
      "fullName": "Хирургически болести",
      "type": "Лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "",
      "floor": "",
      "teacher": "доц. д-р Щерю Николаев Щерев, д.м.",
      "startTime": "11:30",
      "endTime": "13:00"
    },
    {
      "day": "ВТ",
      "subject": "ВБ1",
      "fullName": "Вътрешни Болести I част",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Клиника по Пневмология и Фтизиатрия",
      "floor": 10,
      "teacher": "проф. д-р Диана Петкова Господинова-Вълкова, д.м.",
      "startTime": "13:15",
      "endTime": "14:45"
    },
    {
      "day": "ПОН",
      "subject": "ХБ",
      "fullName": "Хирургически болести",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Втора Клиника по Хирургия",
      "floor": 2,
      "teacher": "доц. д-р Щерю Николаев Щерев, д.м.",
      "startTime": "11:30",
      "endTime": "13:30",
      "additionalInfo": "Преместено от вторник 15:00-18:00."
    },
    {
      "day": "СР",
      "subject": "ОМ",
      "fullName": "Обща медицина",
      "type": "Лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Вл. Иванов",
      "floor": "",
      "teacher": "проф. д-р Валентина Христова Маджова, д.м.",
      "startTime": "09:45",
      "endTime": "11:15"
    },
    {
      "day": "СР",
      "subject": "мген",
      "fullName": "Медицинска генетика",
      "type": "Лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Аудитория А",
      "floor": 2,
      "teacher": "проф. д-р Людмила Бончева Ангелова, д.м.",
      "startTime": "11:30",
      "endTime": "13:00"
    },
    {
      "day": "СР",
      "subject": "НБ",
      "fullName": "Нервни Болести",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Клиника по Нервни Болести",
      "floor": 14,
      "teacher": "доц. д-р Дарина Кирилова Георгиева-Христова, д.м.",
      "startTime": "13:15",
      "endTime": "14:45"
    },
    {
      "day": "СР",
      "subject": "мген",
      "fullName": "Медицинска генетика",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "235",
      "floor": 2,
      "teacher": "гл. ас. д-р Милена Петрова Стоянова, д.м.",
      "startTime": "15:00",
      "endTime": "16:30"
    },
    {
      "day": "ЧЕТ",
      "subject": "кимун",
      "fullName": "Клинична имунология",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "208",
      "floor": 2,
      "teacher": "ас. д-р Ивелин Милев Кръстев",
      "startTime": "08:00",
      "endTime": "09:30"
    },
    {
      "day": "ЧЕТ",
      "subject": "ВБ1",
      "fullName": "Вътрешни Болести I част",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Клиника по Пневмология и Фтизиатрия",
      "floor": 10,
      "teacher": "проф. д-р Диана Петкова Господинова-Вълкова, д.м.",
      "startTime": "09:45",
      "endTime": "11:15"
    },
    {
      "day": "ЧЕТ",
      "subject": "фарм",
      "fullName": "Фармакология",
      "type": "Лекция",
      "building": "ФФ",
      "room": "105",
      "floor": 1,
      "teacher": "доц. д-р Силвия Ганчева Маринова, д.м.",
      "startTime": "11:30",
      "endTime": "13:00"
    },
    {
      "day": "ЧЕТ",
      "subject": "ВБ1",
      "fullName": "Вътрешни Болести I част",
      "type": "Лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Аудитория А",
      "floor": 2,
      "teacher": "доц. д-р Валентина Димова Димитрова, д.м.",
      "startTime": "13:30",
      "endTime": "15:00"
    },
    {
      "day": "ЧЕТ",
      "subject": "рент.",
      "fullName": "Рентгенология, радиология",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "168 / 2 зала",
      "floor": 1,
      "teacher": "ас. д-р Бойко Красенов Матев",
      "startTime": "15:15",
      "endTime": "17:30"
    },
    {
      "day": "ПЕТ",
      "subject": "рент.",
      "fullName": "Рентгенология, радиология",
      "type": "Лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Аудитория А",
      "floor": 2,
      "teacher": "проф. д-р Радослав Йосифов Георгиев, д.м.",
      "startTime": "07:30",
      "endTime": "09:00"
    },
    {
      "day": "ПЕТ",
      "subject": "ВБ1",
      "fullName": "Вътрешни Болести I част",
      "type": "Лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Вл. Иванов",
      "floor": 2,
      "teacher": "проф. д-р Диана Петкова Господинова-Вълкова, д.м.",
      "startTime": "09:15",
      "endTime": "10:45"
    },
    {
      "day": "ПЕТ",
      "subject": "УНГ",
      "fullName": "Ушни, носни и гърлени болести",
      "type": "Упражнение",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Клиника по УНГ Болести",
      "floor": 3,
      "teacher": "проф. д-р Николай Руменов Сапунджиев, д.м.",
      "startTime": "11:00",
      "endTime": "13:15"
    },
    {
      "day": "ПЕТ",
      "subject": "НБ",
      "fullName": "Нервни Болести",
      "type": "Лекция",
      "building": "СВ. МАРИНА - УМБАЛ",
      "room": "Аудитория А",
      "floor": 2,
      "teacher": "проф. д-р Силва Петева Андонова-Атанасова, д.м.н.",
      "startTime": "13:30",
      "endTime": "15:00"
    }
  ],
  
  // ПРОМЕНИ ЗА КОНКРЕТНИ СЕДМИЦИ
  "overrides": {
    // Пример: Седмица 3 - УНГ упражнението става колоквиум
    "3": [
      {
        "day": "ПЕТ",
        "subject": "УНГ",
        "startTime": "11:00",
        "changes": {
          "type": "Колоквиум",
          "additionalInfo": "Колоквиумът е от 11:00 до 13:15. Носете си химикалка!"
        }
      },
      {
        "removeDay": "СР" 
      },
      {
      "day": "ЧЕТ",
        "subject": "ОМ",
        "fullName": "Обща Медицина",
        "type": "Упражнение",
        "building": "ДКЦ",
        "room": "",
        "floor": "",
        "teacher": "доц. д-р Женя Русева Петрова, д.м.",
        "startTime": "08:00",
        "endTime": "09:30",
        "additionalInfo": "От 8:30 започва"
    },
      {
       "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes": {
          "removed": true
        }
      }
    ],
    
    // Пример: Седмица 5 - добавен тест с допълнителна информация
    "5": [
      {
        "day": "СР",
        "subject": "ТЕСТ",
        "fullName": "Тест по Фармакология",
        "type": "Тест",
        "building": "Ректорат",
        "room": "Зала 5",
        "floor": 3,
        "teacher": "доц. д-р Силвия Ганчева Маринова, д.м.",
        "startTime": "10:00",
        "endTime": "11:30",
        "additionalInfo": "Тестът е затворен тип. 30 въпроса за 90 минути."
      },
      {
      "day": "ЧЕТ",
        "subject": "ОМ",
        "fullName": "Обща Медицина",
        "type": "Упражнение",
        "building": "ДКЦ",
        "room": "",
        "floor": "",
        "teacher": "доц. д-р Женя Русева Петрова, д.м.",
        "startTime": "08:00",
        "endTime": "09:30",
        "additionalInfo": "От 8:30 започва"
    },
      {
       "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes": {
          "removed": true
        }
      }
    ],
    "2": [
      {
        "removeDay": "ПОН", 
      }
    ],
	 "13": [
      {
        "removeDay": "ПОН"
      },
      {
        "removeDay": "ВТ"
      }
    ],
     "6": [
      {
      "day": "ПОН",
        "subject": "фарм",
        "startTime": "07:15",
        "changes": {
          "type": "Колоквиум",
        }
      }
     ],
        "7": [
      {
        "removeDay": "ПЕТ"
      },
          {
      "day": "ВТ",
        "subject": "клпат",
        "startTime": "08:00",
        "changes": {
          "type": "Колоквиум",
        }
      },
      {
      "day": "ЧЕТ",
        "subject": "ОМ",
        "fullName": "Обща Медицина",
        "type": "Упражнение",
        "building": "ДКЦ",
        "room": "",
        "floor": "",
        "teacher": "доц. д-р Женя Русева Петрова, д.м.",
        "startTime": "08:00",
        "endTime": "09:30",
        "additionalInfo": "От 8:30 започва"
    },
      {
       "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes": {
          "removed": true
        }
      }
     ],
     "11": [
      {
      "day": "ЧЕТ",
        "subject": "ОМ",
        "fullName": "Обща Медицина",
        "type": "Колоквиум",
        "building": "ДКЦ",
        "room": "",
        "floor": "",
        "teacher": "доц. д-р Женя Русева Петрова, дn.м.",
        "startTime": "08:00",
        "endTime": "09:30",
        "additionalInfo": "От 8:30 започва"
    },
      {
       "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes": {
          "removed": true
        }
      },
      {
       "day": "ЧЕТ",
        "subject": "ВБ1",
        "startTime": "09:45",
        "changes": {
          "removed": true
        }
      },
       {
        "day": "ПЕТ",
        "subject": "ВБ1",
        "startTime": "09:15",
        "changes": {
          "type": "Важна лекция",
      }
    },
    {
        "day": "ВТ",
        "subject": "АГ",
        "startTime": "09:45",
        "changes": {
          "type": "Колоквиум",
      }
    },
     {
        "day": "ЧЕТ",
        "subject": "ВБ1",
        "startTime": "13:30",
        "changes": {
          "type": "Важна лекция",
      }
    } 
     ],
     "10": [
      {
      "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes":{ 
          "type": "Колоквиум",
        }
    },
     {
        "day": "ПЕТ",
        "subject": "ВБ1",
        "startTime": "09:15",
        "changes": {
          "type": "Важна лекция",
      }
    } 
     ],
      "8": [
      {
        "day": "ПЕТ",
        "subject": "ВБ1",
        "startTime": "09:15",
        "changes": {
          "type": "Важна лекция",
      }
    } 
     ],
     "12": [
      {
        "day": "ЧЕТ",
        "subject": "ВБ1",
        "startTime": "13:30",
        "changes": {
          "type": "Важна лекция",
      }
    },
    {
        "day": "ПОН",
        "subject": "фарм",
        "startTime": "07:15",
        "changes": {
          "type": "Колоквиум",
      }
    },
    {
        "day": "ПЕТ",
        "subject": "ВБ1",
        "startTime": "09:15",
        "changes": {
          "type": "Важна лекция",
      }  
    }
     ],
     "13": [
      {
        "removeDay": "ПОН"
      },
      {
        "removeDay": "ВТ"
      },
      {
      "day": "ЧЕТ",
        "subject": "ОМ",
        "fullName": "Обща Медицина",
        "type": "Упражнение",
        "building": "ДКЦ",
        "room": "",
        "floor": "",
        "teacher": "доц. д-р Женя Русева Петрова, д.м.",
        "startTime": "08:00",
        "endTime": "09:30",
        "additionalInfo": "От 8:30 започва"
    },
      {
       "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes": {
          "removed": true
        }
      },
      {
        "day": "ПЕТ",
        "subject": "ВБ1",
        "startTime": "09:15",
        "changes": {
          "type": "Важна лекция",
      }
    },
    {
        "day": "ЧЕТ",
        "subject": "ВБ1",
        "startTime": "13:30",
        "changes": {
          "type": "Важна лекция",
      }
    } 
     ],
     "14": [
      {
        "day": "ЧЕТ",
        "subject": "ВБ1",
        "startTime": "13:30",
        "changes": {
          "type": "Важна лекция",
      }
    } 
     ],
     "9": [
      {
      "day": "СР",
        "subject": "мген",
        "startTime": "15:00",
        "changes": {
          "type": "Колоквиум",
        }
      },
      {
      "day": "ЧЕТ",
        "subject": "ОМ",
        "fullName": "Обща Медицина",
        "type": "Упражнение",
        "building": "ДКЦ",
        "room": "",
        "floor": "",
        "teacher": "доц. д-р Женя Русева Петрова, д.м.",
        "startTime": "08:00",
        "endTime": "09:30",
        "additionalInfo": "От 8:30 започва"
    },
    {
       "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes": {
          "removed": true
        }
      },
        {
       "day": "ЧЕТ",
        "subject": "рент.",
        "startTime": "15:15",
        "changes": {
          "removed": true
        }
      },
    {
        "day": "ПЕТ",
        "subject": "ВБ1",
        "startTime": "09:15",
        "changes": {
          "type": "Важна лекция",
      }
    },
	{
        "day": "ПЕТ",
        "subject": "рент.",
        "startTime": "07:30",
        "changes": {
          "type": "Колоквиум",
      }
    },
     {
        "day": "ЧЕТ",
        "subject": "ВБ1",
        "startTime": "13:30",
        "changes": {
          "type": "Важна лекция",
      }
    } 
     ],
		 "15": [
      {
        "removeDay": "СР", 
      },
      {
		"removeDay": "ЧЕТ", 
      },
      {
		"removeDay": "ПЕТ", 
      }
    ],
    "1": [
      {
        "removeDay": "ПОН", 
      },
      {
      "day": "ЧЕТ",
        "subject": "ОМ",
        "fullName": "Обща Медицина",
        "type": "Упражнение",
        "building": "ДКЦ",
        "room": "",
        "floor": "",
        "teacher": "доц. д-р Женя Русева Петрова, д.м.",
        "startTime": "08:00",
        "endTime": "09:30",
        "additionalInfo": "От 8:30 започва"
    },
      {
       "day": "ЧЕТ",
        "subject": "кимун",
        "startTime": "08:00",
        "changes": {
          "removed": true
        }
      }
    ]
  },
  
  // СЕДМИЦИ - само датите
  "weeks": [
    { "startDate": "2025-09-15" },  // Седмица 1
    { "startDate": "2025-09-22" },  // Седмица 2
    { "startDate": "2025-09-29" },  // Седмица 3
    { "startDate": "2025-10-06" },  // Седмица 4
    { "startDate": "2025-10-13" },  // Седмица 5
    { "startDate": "2025-10-20" },  // Седмица 6
    { "startDate": "2025-10-27" },  // Седмица 7
    { "startDate": "2025-11-03" },  // Седмица 8
    { "startDate": "2025-11-10" },  // Седмица 9
    { "startDate": "2025-11-17" },  // Седмица 10
    { "startDate": "2025-11-24" },  // Седмица 11
    { "startDate": "2025-12-01" },  // Седмица 12
    { "startDate": "2025-12-08" },  // Седмица 13
    { "startDate": "2025-12-15" },  // Седмица 14
	{ "startDate": "2025-12-22" },  // Седмица 15
    { "startDate": "2025-12-24" },  // Коледна ваканция
    { "startDate": "2026-01-02" }   // Изпитна сесия
  ]
};
