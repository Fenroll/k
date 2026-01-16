/**
 * Создавач на вопроси и тестирање
 * Дозволува создавање на прилагодени тестови со вишестопни избирни прашања
 * Копира логика за оценување и прикажување од фармакологијата
 */

document.addEventListener('DOMContentLoaded', function() {
  // DOM елементи
  const testTitleInput = document.getElementById('testTitle');
  const questionsContainer = document.getElementById('questionsContainer');
  const addQuestionBtn = document.getElementById('addQuestionBtn');
  const startQCTestBtn = document.getElementById('startQCTestBtn');
  const exportQCBtn = document.getElementById('exportQCBtn');
  const clearQCFormBtn = document.getElementById('clearQCFormBtn');
  const importQCFile = document.getElementById('importQCFile');
  
  // Елементи за тестирање
  const questionCreatorTestRunner = document.getElementById('questionCreatorTestRunner');
  const qcQuestionContainer = document.getElementById('qcQuestionContainer');
  const qcTestTitle = document.getElementById('qcTestTitle');
  const qcCurrentQuestion = document.getElementById('qcCurrentQuestion');
  const qcTotalQuestions = document.getElementById('qcTotalQuestions');
  const qcPrevQuestionBtn = document.getElementById('qcPrevQuestionBtn');
  const qcNextQuestionBtn = document.getElementById('qcNextQuestionBtn');
  const qcSubmitTestBtn = document.getElementById('qcSubmitTestBtn');
  
  // Елементи за резултати
  const questionCreatorResultsSection = document.getElementById('questionCreatorResultsSection');
  const qcScorePercentage = document.getElementById('qcScorePercentage');
  const qcCorrectAnswers = document.getElementById('qcCorrectAnswers');
  const qcTotalAnswers = document.getElementById('qcTotalAnswers');
  const qcDetailedResults = document.getElementById('qcDetailedResults');
  const qcRestartTestBtn = document.getElementById('qcRestartTestBtn');
  const qcNewTestBtn = document.getElementById('qcNewTestBtn');
  
  // Променливи за состојба
  let questions = [];
  let currentQuestionIndex = 0;
  let userAnswers = [];
  let questionCounter = 0;
  let selectedTestQuestionCount = 5;
  let testQuestions = [];
  
  // Инијализирај
  init();
  
  function init() {
    addQuestionBtn.addEventListener('click', addQuestion);
    startQCTestBtn.addEventListener('click', startTest);
    exportQCBtn.addEventListener('click', exportJSON);
    clearQCFormBtn.addEventListener('click', clearForm);
    importQCFile.addEventListener('change', importJSON);
    qcPrevQuestionBtn.addEventListener('click', previousQuestion);
    qcNextQuestionBtn.addEventListener('click', nextQuestion);
    qcSubmitTestBtn.addEventListener('click', submitTest);
    qcRestartTestBtn.addEventListener('click', restartTest);
    qcNewTestBtn.addEventListener('click', newTest);
    
    // Додај прво прашање
    addQuestion();
  }
  
  /**
   * Додај ново прашање
   */
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
  
  /**
   * Избриши прашање
   */
  function removeQuestion(id) {
    questions = questions.filter(q => q.id !== id);
    questionCounter--;
    renderQuestions();
  }
  
  /**
   * Ажурирај текст на прашање
   */
  function updateQuestionText(id, text) {
    const question = questions.find(q => q.id === id);
    if (question) {
      question.text = text;
    }
  }
  
  /**
   * Ажурирај одговор во прашање
   */
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
  
  /**
   * Избриши одговор од прашање
   */
  function removeAnswer(questionId, answerIndex) {
    const question = questions.find(q => q.id === questionId);
    if (question && question.answers.length > 2) { // Задржи барем 2 одговора
      question.answers.splice(answerIndex, 1);
      // Прилагоди correctIndex ако е потребно
      if (question.correctIndex >= question.answers.length) {
        question.correctIndex = question.answers.length - 1;
      }
      renderQuestions();
    }
  }
  
  /**
   * Постави правилен одговор за прашање
   */
  function setCorrectAnswer(questionId, answerIndex) {
    const question = questions.find(q => q.id === questionId);
    if (question) {
      question.correctIndex = answerIndex;
      renderQuestions();
    }
  }
  
  /**
   * Прикажи сите прашања во формата
   */
  function renderQuestions() {
    questionsContainer.innerHTML = '';
    
    questions.forEach((question, index) => {
      const questionDiv = document.createElement('div');
      questionDiv.className = 'question-item';
      
      // Заглавие на прашање
      const header = document.createElement('div');
      header.className = 'question-item-header';
      
      const numberLabel = document.createElement('div');
      numberLabel.className = 'question-item-number';
      numberLabel.textContent = `Прашање ${index + 1}`;
      
      const actions = document.createElement('div');
      actions.className = 'question-item-actions';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-danger btn-small';
      deleteBtn.textContent = 'Избриши';
      deleteBtn.addEventListener('click', () => removeQuestion(question.id));
      
      actions.appendChild(deleteBtn);
      header.appendChild(numberLabel);
      header.appendChild(actions);
      questionDiv.appendChild(header);
      
      // Текст на прашање
      const questionGroup = document.createElement('div');
      questionGroup.className = 'form-group';
      
      const questionLabel = document.createElement('label');
      questionLabel.textContent = 'Прашање:';
      
      const questionInput = document.createElement('textarea');
      questionInput.className = 'form-control';
      questionInput.style.minHeight = '80px';
      questionInput.value = question.text;
      questionInput.addEventListener('change', (e) => updateQuestionText(question.id, e.target.value));
      
      questionGroup.appendChild(questionLabel);
      questionGroup.appendChild(questionInput);
      questionDiv.appendChild(questionGroup);
      
      // Секција за одговори
      const answersContainer = document.createElement('div');
      answersContainer.className = 'answers-container';
      
      const answersLabel = document.createElement('label');
      answersLabel.textContent = 'Одговори:';
      answersContainer.appendChild(answersLabel);
      
      question.answers.forEach((answer, answerIndex) => {
        const answerRow = document.createElement('div');
        answerRow.className = 'answer-item-row';
        
        // Checkbox за правилен одговор
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
        correctLabel.title = 'Правилан одговор';
        correctLabel.style.fontSize = '12px';
        correctLabel.style.cursor = 'pointer';
        checkboxDiv.appendChild(correctLabel);
        
        // Инпут за одговор
        const answerInput = document.createElement('input');
        answerInput.type = 'text';
        answerInput.className = 'answer-input';
        answerInput.placeholder = `Одговор ${answerIndex + 1}`;
        answerInput.value = answer;
        answerInput.addEventListener('change', (e) => updateAnswer(question.id, answerIndex, e.target.value));
        
        // Копче за избирање на одговор
        const deleteAnswerBtn = document.createElement('button');
        deleteAnswerBtn.type = 'button';
        deleteAnswerBtn.className = 'btn btn-danger btn-small';
        deleteAnswerBtn.textContent = '✕';
        deleteAnswerBtn.title = 'Избриши одговор';
        deleteAnswerBtn.addEventListener('click', () => removeAnswer(question.id, answerIndex));
        deleteAnswerBtn.style.padding = '6px 8px';
        
        answerRow.appendChild(checkboxDiv);
        answerRow.appendChild(answerInput);
        if (question.answers.length > 2) {
          answerRow.appendChild(deleteAnswerBtn);
        }
        
        answersContainer.appendChild(answerRow);
      });
      
      // Копче за додавање на одговор
      const addAnswerBtn = document.createElement('button');
      addAnswerBtn.type = 'button';
      addAnswerBtn.className = 'btn btn-secondary btn-small';
      addAnswerBtn.textContent = '+ Додај одговор';
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
  
  /**
   * Валидирај форма
   */
  function validateForm() {
    if (!testTitleInput.value.trim()) {
      alert('Укажи наслов на тестот');
      return false;
    }
    
    if (questions.length === 0) {
      alert('Креирај барем едно прашање');
      return false;
    }
    
    for (let q of questions) {
      if (!q.text.trim()) {
        alert('Сите прашања мораат да имаат текст');
        return false;
      }
      
      if (q.answers.length < 2) {
        alert('Секое прашање мора да има барем 2 одговора');
        return false;
      }
      
      for (let answer of q.answers) {
        if (!answer.trim()) {
          alert('Сите одговори мораат да имаат текст');
          return false;
        }
      }
    }
    
    return true;
  }
  
  /**
   * Почни тест
   */
  function startTest() {
    if (!validateForm()) return;
    
    // Добиј број на прашања за вклучување
    const numInput = prompt('Колку прашања за тестот? (максимум ' + questions.length + ')', Math.min(5, questions.length));
    if (!numInput) return;
    
    selectedTestQuestionCount = Math.min(parseInt(numInput) || 5, questions.length);
    if (selectedTestQuestionCount < 1) selectedTestQuestionCount = 1;
    
    // Мешај и избери прашања
    testQuestions = shuffleArray([...questions]).slice(0, selectedTestQuestionCount);
    
    // Инијализирај одговори на корисникот
    userAnswers = new Array(testQuestions.length).fill(null);
    currentQuestionIndex = 0;
    
    // Ажурирај UI
    qcTestTitle.textContent = testTitleInput.value;
    qcTotalQuestions.textContent = testQuestions.length;
    
    // Скриј создавач, покажи тестирање
    document.getElementById('questionCreatorSection').classList.add('hidden');
    questionCreatorTestRunner.classList.remove('hidden');
    questionCreatorResultsSection.classList.add('hidden');
    
    // Прикажи прво прашање
    displayCurrentQuestion();
  }
  
  /**
   * Прикажи тековното прашање
   */
  function displayCurrentQuestion() {
    const question = testQuestions[currentQuestionIndex];
    
    // Ажурирај прогресија
    qcCurrentQuestion.textContent = currentQuestionIndex + 1;
    
    // Исчисти контејнер
    qcQuestionContainer.innerHTML = '';
    
    // Создај елемент за прашање
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
      
      // Проверај дали је опција избрана
      if (userAnswers[currentQuestionIndex] === index) {
        optionEl.classList.add('selected');
      }
      
      optionEl.addEventListener('click', () => {
        // Отстрани избранатокласа од сите опции
        optionsContainer.querySelectorAll('.option').forEach(opt => {
          opt.classList.remove('selected');
        });
        
        // Додај избранатокласа на кликнатата опција
        optionEl.classList.add('selected');
        
        // Зачувај одговор на корисникот
        userAnswers[currentQuestionIndex] = index;
      });
      
      optionsContainer.appendChild(optionEl);
    });
    
    questionEl.appendChild(optionsContainer);
    qcQuestionContainer.appendChild(questionEl);
    
    // Ажурирај состојба на копчињата
    qcPrevQuestionBtn.disabled = currentQuestionIndex === 0;
    qcNextQuestionBtn.disabled = currentQuestionIndex === testQuestions.length - 1;
    qcSubmitTestBtn.style.display = currentQuestionIndex === testQuestions.length - 1 ? 'inline-block' : 'none';
  }
  
  /**
   * Оди на претходно прашање
   */
  function previousQuestion() {
    if (currentQuestionIndex > 0) {
      currentQuestionIndex--;
      displayCurrentQuestion();
    }
  }
  
  /**
   * Оди на следно прашање
   */
  function nextQuestion() {
    if (currentQuestionIndex < testQuestions.length - 1) {
      currentQuestionIndex++;
      displayCurrentQuestion();
    }
  }
  
  /**
   * Предај тест и пресметај резултати
   */
  function submitTest() {
    // Пресметај резултат (копирано од фармакологијата)
    let correctCount = 0;
    const results = [];
    
    testQuestions.forEach((question, index) => {
      const isCorrect = userAnswers[index] === question.correctIndex;
      if (isCorrect) {
        correctCount++;
      }
      
      results.push({
        question: question.text,
        userAnswer: userAnswers[index] !== null ? question.answers[userAnswers[index]] : 'Нема одговор',
        correctAnswer: question.answers[question.correctIndex],
        isCorrect: isCorrect
      });
    });
    
    const totalQuestions = testQuestions.length;
    const percentage = Math.round((correctCount / totalQuestions) * 100);
    
    // Ажурирај елементи за резултати
    qcScorePercentage.textContent = percentage + '%';
    qcCorrectAnswers.textContent = correctCount;
    qcTotalAnswers.textContent = totalQuestions;
    
    // Прикажи детални резултати
    qcDetailedResults.innerHTML = '';
    results.forEach((result, index) => {
      const resultDiv = document.createElement('div');
      resultDiv.style.marginBottom = '16px';
      resultDiv.style.padding = '12px';
      resultDiv.style.borderLeft = result.isCorrect ? '4px solid #22c55e' : '4px solid #ef4444';
      resultDiv.style.backgroundColor = result.isCorrect ? '#f0fdf4' : '#fef2f2';
      resultDiv.style.borderRadius = '4px';
      
      const questionH = document.createElement('strong');
      questionH.textContent = `Прашање ${index + 1}: ${result.question}`;
      resultDiv.appendChild(questionH);
      
      const userAnswerP = document.createElement('p');
      userAnswerP.style.margin = '8px 0 0 0';
      userAnswerP.style.color = result.isCorrect ? '#16a34a' : '#dc2626';
      userAnswerP.innerHTML = `<strong>Твој одговор:</strong> ${result.userAnswer}`;
      resultDiv.appendChild(userAnswerP);
      
      if (!result.isCorrect) {
        const correctAnswerP = document.createElement('p');
        correctAnswerP.style.margin = '4px 0 0 0';
        correctAnswerP.style.color = '#16a34a';
        correctAnswerP.innerHTML = `<strong>Правилан одговор:</strong> ${result.correctAnswer}`;
        resultDiv.appendChild(correctAnswerP);
      }
      
      qcDetailedResults.appendChild(resultDiv);
    });
    
    // Скриј тестирање, покажи резултати
    questionCreatorTestRunner.classList.add('hidden');
    questionCreatorResultsSection.classList.remove('hidden');
  }
  
  /**
   * Повтори тест
   */
  function restartTest() {
    currentQuestionIndex = 0;
    userAnswers = new Array(testQuestions.length).fill(null);
    
    // Покажи тестирање, скриј резултати
    questionCreatorTestRunner.classList.remove('hidden');
    questionCreatorResultsSection.classList.add('hidden');
    
    // Прикажи прво прашање
    displayCurrentQuestion();
  }
  
  /**
   * Создај нов тест
   */
  function newTest() {
    // Покажи создавач, скриј резултати
    document.getElementById('questionCreatorSection').classList.remove('hidden');
    questionCreatorTestRunner.classList.add('hidden');
    questionCreatorResultsSection.classList.add('hidden');
  }
  
  /**
   * Експортирај прашања како JSON
   */
  function exportJSON() {
    if (!validateForm()) return;
    
    const data = {
      title: testTitleInput.value,
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
  
  /**
   * Импортирај прашања од JSON
   */
  function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        
        if (!data.title || !data.questions) {
          alert('Неважечки JSON формат');
          return;
        }
        
        // Учитај податоци
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
        alert('Прашањата се вчитаа успешно!');
      } catch (err) {
        alert('Грешка при вчитување на JSON: ' + err.message);
      }
    };
    
    reader.readAsText(file);
  }
  
  /**
   * Исчисти формата
   */
  function clearForm() {
    if (confirm('Си сигурен? Сите прашања ќе бидат избришани.')) {
      testTitleInput.value = '';
      questions = [];
      questionCounter = 0;
      renderQuestions();
      addQuestion();
    }
  }
  
  /**
   * Мешај низа
   */
  function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
});
