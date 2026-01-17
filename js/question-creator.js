// Чека се за конплетно вчитување на страната
console.log('question-creator.js се вчитува...');

function checkAndInitialize() {
  console.log('Проверка на DOM статус...');
  console.log('document.readyState:', document.readyState);
  
  if (document.readyState === 'loading') {
    // DOM все още се вчитва
    document.addEventListener('DOMContentLoaded', function() {
      console.log('DOM готов, инициџализирање на Question Creator...');
      setTimeout(function() {
        console.log('ПРЕДИ инициџализирање - #testTitle съществува ли?', document.getElementById('testTitle'));
        initializeQuestionCreator();
      }, 100);
    });
  } else {
    // DOM е вече готов
    console.log('DOM е готов веднага, инициџализирање на Question Creator...');
    setTimeout(function() {
      console.log('ПРЕДИ инициџализирање - #testTitle съществува ли?', document.getElementById('testTitle'));
      initializeQuestionCreator();
    }, 100);
  }
}

checkAndInitialize();

function initializeQuestionCreator() {
  console.log('========== НАЧАЛО НА ИНИЦИЏАЛИЗИРАЊЕ ==========');
  console.log('Почнува инициџализирање на Question Creator...');
  
  // Проверка на елементи
  console.log('Търсене на елементи в DOM...');
  const questionsContainer = document.getElementById('questionsContainer');
  const addQuestionBtn = document.getElementById('addQuestionBtn');
  const startQCTestBtn = document.getElementById('startQCTestBtn');
  const exportQCBtn = document.getElementById('exportQCBtn');
  const clearQCFormBtn = document.getElementById('clearQCFormBtn');
  const importQCFile = document.getElementById('importQCFile');
  
  const questionCountMenu = document.getElementById('questionCountMenu');
  const qcCustomCount = document.getElementById('qcCustomCount');
  const qcAllCount = document.getElementById('qcAllCount');
  
  const questionCreatorTestRunner = document.getElementById('questionCreatorTestRunner');
  const qcQuestionContainer = document.getElementById('qcQuestionContainer');
  const qcCurrentQuestion = document.getElementById('qcCurrentQuestion');
  const qcTotalQuestions = document.getElementById('qcTotalQuestions');
  const qcPrevQuestionBtn = document.getElementById('qcPrevQuestionBtn');
  const qcNextQuestionBtn = document.getElementById('qcNextQuestionBtn');
  const qcSubmitTestBtn = document.getElementById('qcSubmitTestBtn');
  
  const questionCreatorResultsSection = document.getElementById('questionCreatorResultsSection');
  const qcScorePercentage = document.getElementById('qcScorePercentage');
  const qcCorrectAnswers = document.getElementById('qcCorrectAnswers');
  const qcTotalAnswers = document.getElementById('qcTotalAnswers');
  const qcDetailedResults = document.getElementById('qcDetailedResults');
  const qcRestartTestBtn = document.getElementById('qcRestartTestBtn');
  const qcNewTestBtn = document.getElementById('qcNewTestBtn');
  
  // Проверки
  console.log('❌ questionsContainer:', questionsContainer);
  console.log('❌ addQuestionBtn:', addQuestionBtn);
  console.log('❌ startQCTestBtn:', startQCTestBtn);
  console.log('❌ questionCountMenu:', questionCountMenu);
  console.log('❌ qcCustomCount:', qcCustomCount);
  console.log('❌ questionCreatorTestRunner:', questionCreatorTestRunner);
  console.log('❌ qcQuestionContainer:', qcQuestionContainer);
  console.log('❌ qcCurrentQuestion:', qcCurrentQuestion);
  console.log('❌ qcTotalQuestions:', qcTotalQuestions);
  console.log('❌ qcPrevQuestionBtn:', qcPrevQuestionBtn);
  console.log('❌ qcNextQuestionBtn:', qcNextQuestionBtn);
  console.log('❌ qcSubmitTestBtn:', qcSubmitTestBtn);
  console.log('❌ questionCreatorResultsSection:', questionCreatorResultsSection);
  
  if (!startQCTestBtn) {
    console.error('🔴 КРИТИЧНА ГРЕШКА: startQCTestBtn НЕ Е НАМЕРЕН В DOM!');
    console.error('🔴 Проверка - дали елементът #startQCTestBtn съществува в HTML файла?');
    console.log('Целия DOM:', document.documentElement.innerHTML.substring(0, 500));
    return;
  }
  
  console.log('✅ ВСИЧКИ ЕЛЕМЕНТИ НАМЕРЕНИ!');
  
  // Состояние
  let questions = [];
  let currentQuestionIndex = 0;
  let userAnswers = [];
  let questionCounter = 0;
  let testQuestions = [];
  
  // Добави първо въпрос
  addQuestion('', ['', '', '', ''], 0);
  updateQuestionCountDisplay();
  
  // Event слушатели
  console.log('✅ Добавяне на event слушатели...');
  
  addQuestionBtn.addEventListener('click', function() {
    console.log('✅ addQuestionBtn клик');
    addQuestion();
    updateQuestionCountDisplay();
  });
  
  startQCTestBtn.addEventListener('click', function() {
    console.log('🔵 startQCTestBtn клик детектиран!');
    console.log('Проверка на форма...');
    
    if (!validateForm()) {
      console.log('🔴 Форма е невалидна - validateForm() върна false');
      return;
    }
    
    console.log('✅ Форма е валидна');
    
    // Прочети брой от input поле
    let count = parseInt(qcCustomCount.value);
    console.log('📝 Стойност от input:', qcCustomCount.value);
    console.log('📊 Прочетен брой:', count);
    
    // Ако input е празен или 0, използвай всички въпроси
    if (!count || count === 0) {
      count = questions.length;
      console.log('📊 Input е празен, използвам всички:', count);
    }
    
    // Валидирай че числото е поне 1
    if (count < 1) {
      alert('Невалидна бройка! Напиши число по-голямо от 0');
      console.log('❌ Число е невалидно:', count);
      return;
    }
    
    // Ако числото е по-голямо от броя въпроси, ще повтаря въпросите
    if (count > questions.length) {
      console.log('📌 Брой ' + count + ' е по-голям от ' + questions.length + ' - въпросите ще се повтарят');
    }
    
    console.log('✅ Стартиране с брой:', count);
    startTestWithCount(count);
  });
  
  qcCustomCount.addEventListener('blur', function() {
    console.log('✅ Blur на input поле');
    let count = parseInt(qcCustomCount.value);
    
    // Ако input е празен, постави всички въпроси
    if (!count || count === 0) {
      qcCustomCount.value = questions.length;
    }
  });
  
  // Премахнати: qcCustomCountBtn event слушател
  
  exportQCBtn.addEventListener('click', function() {
    console.log('✅ exportQCBtn клик');
    exportJSON();
  });
  
  clearQCFormBtn.addEventListener('click', function() {
    console.log('✅ clearQCFormBtn клик');
    clearForm();
    updateQuestionCountDisplay();
  });
  
  importQCFile.addEventListener('change', function(e) {
    console.log('✅ importQCFile промена');
    importJSON(e);
    updateQuestionCountDisplay();
  });
  
  qcPrevQuestionBtn.addEventListener('click', function() {
    console.log('✅ qcPrevQuestionBtn клик');
    previousQuestion();
  });
  
  qcNextQuestionBtn.addEventListener('click', function() {
    console.log('✅ qcNextQuestionBtn клик');
    nextQuestion();
  });
  
  qcSubmitTestBtn.addEventListener('click', function() {
    console.log('✅ qcSubmitTestBtn клик');
    submitTest();
  });
  
  qcRestartTestBtn.addEventListener('click', function() {
    console.log('✅ qcRestartTestBtn клик');
    restartTest();
  });
  
  qcNewTestBtn.addEventListener('click', function() {
    console.log('✅ qcNewTestBtn клик');
    newTest();
    updateQuestionCountDisplay();
  });
  
  console.log('========== ВСИЧКИ EVENT СЛУШАТЕЛИ ДОБАВЕНИ =========');
  console.log('========== ИНИЦИЏАЛИЗИРАЊЕ ЗАВРШЕНО ==========');
  
  function updateQuestionCountDisplay() {
    const totalCount = questions.length;
    // Покажи числото в label
    qcAllCount.textContent = '(' + totalCount + ')';
    // Постави числото в input полето като placeholder или value
    qcCustomCount.value = totalCount;
  }
  
  // Функции
  function addQuestion(questionText = '', answers = ['', '', '', ''], correctIndex = 0) {
    questionCounter++;
    questions.push({
      id: questionCounter,
      text: questionText,
      answers: answers,
      correctIndex: correctIndex
    });
    
    renderQuestions();
  }
  
  function removeQuestion(id) {
    questions = questions.filter(q => q.id !== id);
    questionCounter--;
    renderQuestions();
  }
  
  function updateQuestionText(id, text) {
    const question = questions.find(q => q.id === id);
    if (question) {
      question.text = text;
    }
  }
  
  function updateAnswer(questionId, answerIndex, text) {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      if (answerIndex >= question.answers.length) {
        question.answers.push(text);
      } else {
        question.answers[answerIndex] = text;
      }
    }
  }
  
  function removeAnswer(questionId, answerIndex) {
    const question = questions.find(q => q.id === questionId);
    if (question && question.answers.length > 2) {
      question.answers.splice(answerIndex, 1);
      if (question.correctIndex >= question.answers.length) {
        question.correctIndex = question.answers.length - 1;
      }
      renderQuestions();
    }
  }
  
  function setCorrectAnswer(questionId, answerIndex) {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      question.correctIndex = answerIndex;
      renderQuestions();
    }
  }
  
  function renderQuestions() {
    questionsContainer.innerHTML = '';
    
    questions.forEach((question, index) => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'question-item';
      
      const header = document.createElement('div');
      header.className = 'question-item-header';
      
      const numberLabel = document.createElement('div');
      numberLabel.className = 'question-item-number';
      numberLabel.textContent = `Въпрос ${index + 1}`;
      
      const actions = document.createElement('div');
      actions.className = 'question-item-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger btn-small';
      deleteBtn.textContent = 'Изтрий';
      deleteBtn.addEventListener('click', () => removeQuestion(question.id));
      
      actions.appendChild(deleteBtn);
      header.appendChild(numberLabel);
      header.appendChild(actions);
      questionDiv.appendChild(header);
      
      const questionGroup = document.createElement('div');
      questionGroup.className = 'form-group';
      
      const questionLabel = document.createElement('label');
      questionLabel.textContent = 'Въпрос:';
      
      const questionInput = document.createElement('textarea');
      questionInput.className = 'form-control';
      questionInput.style.minHeight = '80px';
      questionInput.value = question.text;
      questionInput.addEventListener('change', (e) => updateQuestionText(question.id, e.target.value));
      
      questionGroup.appendChild(questionLabel);
      questionGroup.appendChild(questionInput);
      questionDiv.appendChild(questionGroup);
      
      const answersContainer = document.createElement('div');
      answersContainer.className = 'answers-container';
      
      const answersLabel = document.createElement('label');
      answersLabel.textContent = 'Отговори:';
      answersContainer.appendChild(answersLabel);
      
      question.answers.forEach((answer, answerIndex) => {
        const answerRow = document.createElement('div');
        answerRow.className = 'answer-item-row';
        
        const checkboxDiv = document.createElement('div');
        checkboxDiv.style.display = 'flex';
        checkboxDiv.style.alignItems = 'center';
        checkboxDiv.style.gap = '4px';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'radio';
        checkbox.name = `correct-${question.id}`;
        checkbox.checked = question.correctIndex === answerIndex;
        checkbox.addEventListener('change', () => setCorrectAnswer(question.id, answerIndex));
        checkboxDiv.appendChild(checkbox);
        
        const correctLabel = document.createElement('label');
        correctLabel.textContent = '✓';
        correctLabel.title = 'Правилен отговор';
        correctLabel.style.fontSize = '12px';
        correctLabel.style.cursor = 'pointer';
        checkboxDiv.appendChild(correctLabel);
        
        const answerInput = document.createElement('input');
        answerInput.type = 'text';
        answerInput.className = 'answer-input';
        answerInput.placeholder = `Отговор ${answerIndex + 1}`;
        answerInput.value = answer;
        answerInput.addEventListener('change', (e) => updateAnswer(question.id, answerIndex, e.target.value));
        
        const deleteAnswerBtn = document.createElement('button');
        deleteAnswerBtn.type = 'button';
        deleteAnswerBtn.className = 'btn btn-danger btn-small';
        deleteAnswerBtn.textContent = '✕';
        deleteAnswerBtn.title = 'Изтрий отговор';
        deleteAnswerBtn.addEventListener('click', () => removeAnswer(question.id, answerIndex));
        deleteAnswerBtn.style.padding = '6px 8px';
        
        answerRow.appendChild(checkboxDiv);
        answerRow.appendChild(answerInput);
        if (question.answers.length > 2) {
          answerRow.appendChild(deleteAnswerBtn);
        }
        
        answersContainer.appendChild(answerRow);
      });
      
      const addAnswerBtn = document.createElement('button');
      addAnswerBtn.type = 'button';
      addAnswerBtn.className = 'btn btn-secondary btn-small';
      addAnswerBtn.textContent = '+ Добави отговор';
      addAnswerBtn.style.marginTop = '8px';
      addAnswerBtn.addEventListener('click', () => {
        question.answers.push('');
        renderQuestions();
      });
      answersContainer.appendChild(addAnswerBtn);
      
      questionDiv.appendChild(answersContainer);
      questionsContainer.appendChild(questionDiv);
    });
  }
  
  function validateForm() {
    console.log('Валидация на форма...');
    
    if (questions.length === 0) {
      alert('Създай поне един въпрос');
      return false;
    }
    
    for (let q of questions) {
      if (!q.text.trim()) {
        alert('Всички въпроси трябва да имат текст');
        return false;
      }
      
      if (q.answers.length < 2) {
        alert('Всеки въпрос трябва да има поне 2 отговора');
        return false;
      }
      
      for (let answer of q.answers) {
        if (!answer.trim()) {
          alert('Всички отговори трябва да имат текст');
          return false;
        }
      }
    }
    
    return true;
  }
  
  function startTestWithCount(selectedCount) {
    console.log('========== startTest ФУНКЦИЯ АКТИВИРАНА ==========');
    console.log('📊 Брой въпроси:', selectedCount);
    
    if (!validateForm()) {
      console.log('🔴 Форма е невалидна - validateForm() върна false');
      return;
    }
    
    console.log('✅ Форма е валидна');
    proceedWithQuestionCount(selectedCount);
  }
  
  function showQuestionCountMenu() {
    console.log('Показване на меню за брой въпроси...');
    console.log('Проверка на форма...');
    
    if (!validateForm()) {
      console.log('🔴 Форма е невалидна - validateForm() върна false');
      return;
    }
    
    console.log('✅ Форма е валидна');
    // Менюто е винаги видимо, просто скролираме до него
    questionCountMenu.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  
  
  function proceedWithQuestionCount(selectedCount) {
    console.log('Продължаване с ' + selectedCount + ' въпроса...');
    
    // Ако има повече избрани въпроси отколкото въпроси в теста, повтаряй ги
    let allQuestionsNeeded = [];
    while (allQuestionsNeeded.length < selectedCount) {
      allQuestionsNeeded = allQuestionsNeeded.concat(shuffleArray([...questions]));
    }
    
    testQuestions = allQuestionsNeeded.slice(0, selectedCount);
    userAnswers = new Array(testQuestions.length).fill(null);
    currentQuestionIndex = 0;
    
    console.log('✅ testQuestions:', testQuestions);
    console.log('✅ userAnswers подготвена:', userAnswers);
    
    // Запазване на първия въпрос
    const firstQuestion = testQuestions[0];
    qcTotalQuestions.textContent = testQuestions.length;
    
    console.log('🔵 Скриване на questionCreatorSection...');
    document.getElementById('questionCreatorSection').classList.add('hidden');    
    console.log('🔵 Скриване на main-header в тест...');
    const questionCreatorTestContainer = document.getElementById('questionCreatorTest');
    const testMainHeader = questionCreatorTestContainer.querySelector('.main-header');
    if (testMainHeader) {
      testMainHeader.classList.add('hidden');
    }
        console.log('🔵 Показване на questionCreatorTestRunner...');
    questionCreatorTestRunner.classList.remove('hidden');
    console.log('🔵 Скриване на questionCreatorResultsSection...');
    questionCreatorResultsSection.classList.add('hidden');
    
    console.log('📲 Показване на първия въпрос...');
    displayCurrentQuestion();
    console.log('========== startTest ЗАВЕРШЕНА ==========');
  }
  
  function displayCurrentQuestion() {
    console.log('📺 displayCurrentQuestion() - въпрос №:', currentQuestionIndex);
    console.log('📺 Всички въпроси:', testQuestions);
    
    const question = testQuestions[currentQuestionIndex];
    
    if (!question) {
      console.error('🔴 ГРЕШКА: Въпрос не е намерен за индекс', currentQuestionIndex);
      return;
    }
    
    console.log('📺 Текущ въпрос:', question);
    
    qcCurrentQuestion.textContent = currentQuestionIndex + 1;
    
    qcQuestionContainer.innerHTML = '';
    
    const questionEl = document.createElement('div');
    questionEl.className = 'question';
    
    const questionText = document.createElement('div');
    questionText.className = 'question-text';
    questionText.textContent = question.text;
    questionEl.appendChild(questionText);
    
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'question-options';
    
    question.answers.forEach((answer, index) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'option';
      optionEl.textContent = answer;
      
      if (userAnswers[currentQuestionIndex] === index) {
        optionEl.classList.add('selected');
      }
      
      optionEl.addEventListener('click', () => {
        optionsContainer.querySelectorAll('.option').forEach(opt => {
          opt.classList.remove('selected');
        });
        
        optionEl.classList.add('selected');
        userAnswers[currentQuestionIndex] = index;
      });
      
      optionsContainer.appendChild(optionEl);
    });
    
    questionEl.appendChild(optionsContainer);
    qcQuestionContainer.appendChild(questionEl);
    
    qcPrevQuestionBtn.disabled = currentQuestionIndex === 0;
    qcNextQuestionBtn.disabled = currentQuestionIndex === testQuestions.length - 1;
    qcSubmitTestBtn.style.display = currentQuestionIndex === testQuestions.length - 1 ? 'inline-block' : 'none';
  }
  
  function previousQuestion() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      displayCurrentQuestion();
    }
  }
  
  function nextQuestion() {
    if (currentQuestionIndex < testQuestions.length - 1) {
      currentQuestionIndex++;
      displayCurrentQuestion();
    }
  }
  
  function submitTest() {
    let correctCount = 0;
    const results = [];
    
    testQuestions.forEach((question, index) => {
      const isCorrect = userAnswers[index] === question.correctIndex;
      if (isCorrect) {
        correctCount++;
      }
      
      results.push({
        question: question.text,
        userAnswer: userAnswers[index] !== null ? question.answers[userAnswers[index]] : 'Няма отговор',
        correctAnswer: question.answers[question.correctIndex],
        isCorrect: isCorrect
      });
    });
    
    const totalQuestions = testQuestions.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    
    qcScorePercentage.textContent = percentage + '%';
    qcCorrectAnswers.textContent = correctCount;
    qcTotalAnswers.textContent = totalQuestions;
    
    qcDetailedResults.innerHTML = '';
    results.forEach((result, index) => {
      const resultDiv = document.createElement('div');
      resultDiv.style.marginBottom = '16px';
      resultDiv.style.padding = '12px';
      resultDiv.style.borderLeft = result.isCorrect ? '4px solid #22c55e' : '4px solid #ef4444';
      resultDiv.style.backgroundColor = result.isCorrect ? '#f0fdf4' : '#fef2f2';
      resultDiv.style.borderRadius = '4px';
      
      const questionH = document.createElement('strong');
      questionH.textContent = `Въпрос ${index + 1}: ${result.question}`;
      resultDiv.appendChild(questionH);
      
      const userAnswerP = document.createElement('p');
      userAnswerP.style.margin = '8px 0 0 0';
      userAnswerP.style.color = result.isCorrect ? '#16a34a' : '#dc2626';
      userAnswerP.innerHTML = `<strong>Твой отговор:</strong> ${result.userAnswer}`;
      resultDiv.appendChild(userAnswerP);
      
      if (!result.isCorrect) {
        const correctAnswerP = document.createElement('p');
        correctAnswerP.style.margin = '4px 0 0 0';
        correctAnswerP.style.color = '#16a34a';
        correctAnswerP.innerHTML = `<strong>Правилен отговор:</strong> ${result.correctAnswer}`;
        resultDiv.appendChild(correctAnswerP);
      }
      
      qcDetailedResults.appendChild(resultDiv);
    });
    
    questionCreatorTestRunner.classList.add('hidden');
    questionCreatorResultsSection.classList.remove('hidden');
  }
  
  function restartTest() {
    currentQuestionIndex = 0;
    userAnswers = new Array(testQuestions.length).fill(null);
    
    questionCreatorTestRunner.classList.remove('hidden');
    questionCreatorResultsSection.classList.add('hidden');
    
    displayCurrentQuestion();
  }
  
  function newTest() {
    document.getElementById('questionCreatorSection').classList.remove('hidden');
    questionCreatorTestRunner.classList.add('hidden');
    questionCreatorResultsSection.classList.add('hidden');
    
    // Покажи main-header отново
    const questionCreatorTestContainer = document.getElementById('questionCreatorTest');
    const testMainHeader = questionCreatorTestContainer.querySelector('.main-header');
    if (testMainHeader) {
      testMainHeader.classList.remove('hidden');
    }
    
    updateQuestionCountDisplay();
  }
  
  function exportJSON() {
    if (!validateForm()) return;
    
    const data = {
      title: (testTitleInput && testTitleInput.value) ? testTitleInput.value : 'Тест',
      questions: questions
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }
  
  function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!data.title || !data.questions) {
          alert('Невалиден JSON формат');
          return;
        }
        
        testTitleInput.value = data.title;
        questions = [];
        questionCounter = 0;
        
        data.questions.forEach(q => {
          questionCounter++;
          questions.push({
            id: questionCounter,
            text: q.text,
            answers: q.answers,
            correctIndex: q.correctIndex
          });
        });
        
        renderQuestions();
        alert('Въпросите се зареждат успешно!');
      } catch (err) {
        alert('Грешка при зареждане на JSON: ' + err.message);
      }
    };
    
    reader.readAsText(file);
  }
  
  function clearForm() {
    if (confirm('Сигурен ли си? Всички въпроси ще бъдат изтрити.')) {
      testTitleInput.value = '';
      questions = [];
      questionCounter = 0;
      renderQuestions();
      addQuestion();
    }
  }
  
  function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
  
  console.log('Question Creator инициџализирање завршено!');
}
