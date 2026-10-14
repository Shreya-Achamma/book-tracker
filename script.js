
"use strict";

/* =====================================
   1. Storage keys and application state
===================================== */

const BOOKS_STORAGE_KEY = "bookTrackerBooks";
const SESSIONS_STORAGE_KEY = "bookTrackerReadingSessions";

const VALID_STATUSES = ["To read", "Reading", "Finished"];

let books = [];
let readingSessions = [];
let displayedMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1
);

let storageAvailable = true;


/* =====================================
   2. Get HTML elements
===================================== */

const bookForm = document.getElementById("book-form");
const titleInput = document.getElementById("book-title");
const authorInput = document.getElementById("book-author");
const statusInput = document.getElementById("book-status");

const titleError = document.getElementById("title-error");
const authorError = document.getElementById("author-error");
const formFeedback = document.getElementById("form-feedback");

const searchInput = document.getElementById("book-search");
const bookList = document.getElementById("book-list");
const emptyState = document.getElementById("empty-state");
const emptyStateTitle = document.getElementById("empty-state-title");
const emptyStateMessage = document.getElementById("empty-state-message");
const visibleBookCount = document.getElementById("visible-book-count");

const totalBooksElement = document.getElementById("total-books");
const toReadCountElement = document.getElementById("to-read-count");
const readingCountElement = document.getElementById("reading-count");
const finishedCountElement = document.getElementById("finished-count");
const completionPercentageElement =
    document.getElementById("completion-percentage");
const completionBar = document.getElementById("completion-bar");
const completionProgress = document.getElementById("completion-progress");

const recordSessionButton = document.getElementById("record-session-btn");
const sessionFeedback = document.getElementById("session-feedback");
const currentStreakElement = document.getElementById("current-streak");
const longestStreakElement = document.getElementById("longest-streak");
const calendarMonthElement = document.getElementById("calendar-month");
const activityCalendar = document.getElementById("activity-calendar");
const previousMonthButton = document.getElementById("previous-month");
const nextMonthButton = document.getElementById("next-month");
const readingInsightText = document.getElementById("reading-insight-text");


/* =====================================
   3. Utility functions
===================================== */

// Get today's date in the user's local timezone.
function getLocalDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Validate a YYYY-MM-DD date without relying on UTC parsing.
function isValidDateKey(dateKey) {
    if (typeof dateKey !== "string") {
        return false;
    }

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    const date = new Date(year, month - 1, day);

    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
}

// Convert a local date key to a day number for safe date comparisons.
function dateKeyToDayNumber(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);

    return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

// Create a unique ID for each book.
function createBookId() {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Format a stored timestamp for display.
function formatDate(timestamp) {
    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
        return "Unknown date";
    }

    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

// Display a feedback message safely.
function showFeedback(element, message, type = "success") {
    element.textContent = message;
    element.classList.remove("feedback-success", "feedback-error");
    element.classList.add(
        type === "error" ? "feedback-error" : "feedback-success"
    );
}


/* =====================================
   4. Load and validate stored data
===================================== */

function loadBooks() {
    try {
        const storedData = localStorage.getItem(BOOKS_STORAGE_KEY);

        if (storedData === null) {
            return [];
        }

        const parsedData = JSON.parse(storedData);

        if (!Array.isArray(parsedData)) {
            throw new Error("Saved book data is not an array.");
        }

        const validBooks = [];
        const usedIds = new Set();

        for (const book of parsedData) {
            if (
                !book ||
                typeof book.id !== "string" ||
                book.id.trim() === "" ||
                usedIds.has(book.id) ||
                typeof book.title !== "string" ||
                !book.title.trim() ||
                typeof book.author !== "string" ||
                !book.author.trim() ||
                !VALID_STATUSES.includes(book.status)
            ) {
                continue;
            }

            const timestamp = new Date(book.createdAt).getTime();

            if (!Number.isFinite(timestamp)) {
                continue;
            }

            usedIds.add(book.id);

            validBooks.push({
                id: book.id,
                title: book.title.trim(),
                author: book.author.trim(),
                status: book.status,
                createdAt: new Date(timestamp).toISOString()
            });
        }

        if (validBooks.length !== parsedData.length) {
            showFeedback(
                formFeedback,
                "Some invalid saved book entries were skipped.",
                "error"
            );
        }

        return validBooks;
    } catch (error) {
        console.error("Could not load saved books:", error);

        showFeedback(
            formFeedback,
            "Saved book data could not be read. A fresh library will be used.",
            "error"
        );

        return [];
    }
}

function loadReadingSessions() {
    try {
        const storedData = localStorage.getItem(SESSIONS_STORAGE_KEY);

        if (storedData === null) {
            return [];
        }

        const parsedData = JSON.parse(storedData);

        if (!Array.isArray(parsedData)) {
            throw new Error("Saved reading sessions are not an array.");
        }

        return [...new Set(
            parsedData.filter(isValidDateKey)
        )].sort();
    } catch (error) {
        console.error("Could not load reading sessions:", error);

        showFeedback(
            sessionFeedback,
            "Saved reading sessions could not be read. No sessions were loaded.",
            "error"
        );

        return [];
    }
}


/* =====================================
   5. Save data to localStorage
===================================== */

function saveBooks() {
    try {
        localStorage.setItem(
            BOOKS_STORAGE_KEY,
            JSON.stringify(books)
        );

        return true;
    } catch (error) {
        storageAvailable = false;
        console.error("Could not save books:", error);

        return false;
    }
}

function saveReadingSessions() {
    try {
        localStorage.setItem(
            SESSIONS_STORAGE_KEY,
            JSON.stringify(readingSessions)
        );

        return true;
    } catch (error) {
        storageAvailable = false;
        console.error("Could not save reading sessions:", error);

        return false;
    }
}

function showStorageWarning(element) {
    showFeedback(
        element,
        "Changes are visible for this session but could not be saved. Check your browser storage settings or available space.",
        "error"
    );
}


/* =====================================
   6. Validate the book form
===================================== */

function clearValidationErrors() {
    titleError.textContent = "";
    authorError.textContent = "";

    titleInput.classList.remove("input-error");
    authorInput.classList.remove("input-error");

    titleInput.removeAttribute("aria-invalid");
    authorInput.removeAttribute("aria-invalid");
}

function validateBookForm(title, author) {
    clearValidationErrors();

    let isValid = true;

    if (!title) {
        titleError.textContent = "Please enter the book title.";
        titleInput.classList.add("input-error");
        titleInput.setAttribute("aria-invalid", "true");
        isValid = false;
    }

    if (!author) {
        authorError.textContent = "Please enter the author's name.";
        authorInput.classList.add("input-error");
        authorInput.setAttribute("aria-invalid", "true");
        isValid = false;
    }

    if (!isValid) {
        showFeedback(
            formFeedback,
            "Please correct the highlighted fields.",
            "error"
        );

        if (!title) {
            titleInput.focus();
        } else {
            authorInput.focus();
        }
    }

    return isValid;
}


/* =====================================
   7. Add a book
===================================== */

bookForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const status = statusInput.value;

    if (!validateBookForm(title, author)) {
        return;
    }

    if (!VALID_STATUSES.includes(status)) {
        showFeedback(
            formFeedback,
            "Please select a valid reading status.",
            "error"
        );
        return;
    }

    const newBook = {
        id: createBookId(),
        title: title,
        author: author,
        status: status,
        createdAt: new Date().toISOString()
    };

    books.push(newBook);

    const saved = saveBooks();

    // Reset the form only after a valid addition.
    bookForm.reset();
    clearValidationErrors();

    renderBooks();
    renderStatistics();

    if (saved) {
        showFeedback(
            formFeedback,
            `"${newBook.title}" was added to your library.`
        );
    } else {
        showStorageWarning(formFeedback);
    }

    titleInput.focus();
});

// Remove validation errors as the user corrects the fields.
titleInput.addEventListener("input", function () {
    if (titleInput.value.trim()) {
        titleError.textContent = "";
        titleInput.classList.remove("input-error");
        titleInput.removeAttribute("aria-invalid");
    }
});

authorInput.addEventListener("input", function () {
    if (authorInput.value.trim()) {
        authorError.textContent = "";
        authorInput.classList.remove("input-error");
        authorInput.removeAttribute("aria-invalid");
    }
});


/* =====================================
   8. Render book cards safely
===================================== */

function createBookCard(book) {
    const card = document.createElement("article");
    card.className = "book-card";

    const top = document.createElement("div");
    top.className = "book-card-top";

    const title = document.createElement("h3");

    // textContent prevents entered text from being interpreted as HTML.
    title.textContent = book.title;

    const badge = document.createElement("span");
    badge.classList.add("status-badge");

    const statusClasses = {
        "To read": "status-to-read",
        "Reading": "status-reading",
        "Finished": "status-finished"
    };

    badge.classList.add(statusClasses[book.status]);
    badge.textContent = book.status;

    top.append(title, badge);

    const author = document.createElement("p");
    author.className = "book-author";
    author.textContent = `By ${book.author}`;

    const date = document.createElement("p");
    date.className = "book-date";
    date.textContent = `Added on ${formatDate(book.createdAt)}`;

    const actions = document.createElement("div");
    actions.className = "book-actions";

    const statusLabel = document.createElement("label");
    statusLabel.className = "visually-hidden";

    const selectId = `status-${book.id}`;
    statusLabel.htmlFor = selectId;
    statusLabel.textContent = `Change status for ${book.title}`;

    const statusSelect = document.createElement("select");
    statusSelect.id = selectId;
    statusSelect.className = "book-status-select";
    statusSelect.setAttribute("aria-label", `Status for ${book.title}`);

    for (const status of VALID_STATUSES) {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = status === book.status;

        statusSelect.appendChild(option);
    }

    statusSelect.addEventListener("change", function () {
        updateBookStatus(book.id, statusSelect.value);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "btn-delete";
    deleteButton.textContent = "Delete";

    deleteButton.setAttribute(
        "aria-label",
        `Delete ${book.title} by ${book.author}`
    );

    deleteButton.addEventListener("click", function () {
        deleteBook(book.id);
    });

    actions.append(statusLabel, statusSelect, deleteButton);

    card.append(top, author, date, actions);

    return card;
}

function renderBooks() {
    const searchTerm = searchInput.value.trim().toLocaleLowerCase();

    const filteredBooks = books
        .filter(function (book) {
            return (
                book.title.toLocaleLowerCase().includes(searchTerm) ||
                book.author.toLocaleLowerCase().includes(searchTerm)
            );
        })
        .sort(function (a, b) {
            return (
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
            );
        });

    bookList.replaceChildren();

    for (const book of filteredBooks) {
        bookList.appendChild(createBookCard(book));
    }

    visibleBookCount.textContent =
        `${filteredBooks.length} ${filteredBooks.length === 1 ? "book" : "books"}`;

    if (filteredBooks.length === 0) {
        emptyState.hidden = false;

        if (books.length === 0) {
            emptyStateTitle.textContent = "Your library is waiting";
            emptyStateMessage.textContent =
                "Add your first book to start building your personal library.";
        } else {
            emptyStateTitle.textContent = "No books found";
            emptyStateMessage.textContent =
                "Try another title or author, or clear your search.";
        }
    } else {
        emptyState.hidden = true;
    }
}

// Update results as the user types.
searchInput.addEventListener("input", renderBooks);


/* =====================================
   9. Change a book's status
===================================== */

function updateBookStatus(bookId, newStatus) {
    if (!VALID_STATUSES.includes(newStatus)) {
        return;
    }

    const book = books.find(function (item) {
        return item.id === bookId;
    });

    if (!book || book.status === newStatus) {
        return;
    }

    const previousStatus = book.status;
    book.status = newStatus;

    const saved = saveBooks();

    renderBooks();
    renderStatistics();

    if (saved) {
        showFeedback(
            formFeedback,
            `"${book.title}" moved from ${previousStatus} to ${newStatus}.`
        );
    } else {
        showStorageWarning(formFeedback);
    }
}


/* =====================================
   10. Delete a book
===================================== */

function deleteBook(bookId) {
    const book = books.find(function (item) {
        return item.id === bookId;
    });

    if (!book) {
        return;
    }

    const confirmed = window.confirm(
        `Are you sure you want to delete "${book.title}" by ${book.author}?`
    );

    if (!confirmed) {
        return;
    }

    books = books.filter(function (item) {
        return item.id !== bookId;
    });

    const saved = saveBooks();

    renderBooks();
    renderStatistics();

    if (saved) {
        showFeedback(
            formFeedback,
            `"${book.title}" was deleted from your library.`
        );
    } else {
        showStorageWarning(formFeedback);
    }
}


/* =====================================
   11. Reading statistics
===================================== */

function renderStatistics() {
    const total = books.length;

    const toRead = books.filter(
        book => book.status === "To read"
    ).length;

    const reading = books.filter(
        book => book.status === "Reading"
    ).length;

    const finished = books.filter(
        book => book.status === "Finished"
    ).length;

    const completion = total === 0
        ? 0
        : Math.round((finished / total) * 100);

    totalBooksElement.textContent = total;
    toReadCountElement.textContent = toRead;
    readingCountElement.textContent = reading;
    finishedCountElement.textContent = finished;

    completionPercentageElement.textContent = `${completion}%`;
    completionBar.style.width = `${completion}%`;

    completionProgress.setAttribute("aria-valuenow", completion);
}


/* =====================================
   12. Record reading sessions
===================================== */

recordSessionButton.addEventListener("click", function () {
    const today = getLocalDateKey();

    if (readingSessions.includes(today)) {
        showFeedback(
            sessionFeedback,
            "You've already recorded a reading session for today.",
            "error"
        );
        return;
    }

    readingSessions.push(today);
    readingSessions.sort();

    const saved = saveReadingSessions();

    renderReadingJourney();

    if (saved) {
        showFeedback(
            sessionFeedback,
            "Today's reading session has been recorded. Keep it up!"
        );
    } else {
        showStorageWarning(sessionFeedback);
    }
});


/* =====================================
   13. Calculate reading streaks
===================================== */

function calculateLongestStreak() {
    if (readingSessions.length === 0) {
        return 0;
    }

    const sortedDates = [...new Set(readingSessions)]
        .sort(function (a, b) {
            return dateKeyToDayNumber(a) - dateKeyToDayNumber(b);
        });

    let longest = 1;
    let current = 1;

    for (let i = 1; i < sortedDates.length; i++) {
        const previousDay = dateKeyToDayNumber(sortedDates[i - 1]);
        const currentDay = dateKeyToDayNumber(sortedDates[i]);

        if (currentDay - previousDay === 1) {
            current++;
        } else if (currentDay !== previousDay) {
            current = 1;
        }

        longest = Math.max(longest, current);
    }

    return longest;
}

function calculateCurrentStreak() {
    const recordedDates = new Set(readingSessions);

    const today = getLocalDateKey();
    const yesterdayDate = new Date();

    yesterdayDate.setDate(yesterdayDate.getDate() - 1);

    const yesterday = getLocalDateKey(yesterdayDate);

    // A streak is active only if today or yesterday was recorded.
    if (!recordedDates.has(today) && !recordedDates.has(yesterday)) {
        return 0;
    }

    let streak = 0;

    const startDate = recordedDates.has(today)
        ? new Date()
        : yesterdayDate;

    const currentDate = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate()
    );

    while (recordedDates.has(getLocalDateKey(currentDate))) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
    }

    return streak;
}


/* =====================================
   14. Monthly reading activity calendar
===================================== */

function renderCalendar() {
    activityCalendar.replaceChildren();

    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();

    calendarMonthElement.textContent =
        displayedMonth.toLocaleDateString(undefined, {
            month: "long",
            year: "numeric"
        });

    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const today = getLocalDateKey();
    const recordedDates = new Set(readingSessions);

    // Empty cells align the first day with its weekday.
    for (let i = 0; i < firstWeekday; i++) {
        const blank = document.createElement("div");
        blank.setAttribute("aria-hidden", "true");
        activityCalendar.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey = getLocalDateKey(new Date(year, month, day));
        const hasSession = recordedDates.has(dateKey);
        const isToday = dateKey === today;

        const dayElement = document.createElement("div");
        dayElement.className = "calendar-day";
        dayElement.textContent = day;

        if (hasSession) {
            dayElement.classList.add("has-session");
        }

        if (isToday) {
            dayElement.classList.add("is-today");
        }

        let accessibleLabel = dateKey;

        if (hasSession) {
            accessibleLabel += ", reading session recorded";
        }

        if (isToday) {
            accessibleLabel += ", today";
        }

        dayElement.setAttribute("aria-label", accessibleLabel);
        dayElement.title = accessibleLabel;

        activityCalendar.appendChild(dayElement);
    }

    // Do not allow navigation into future months.
    const currentMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
    );

    nextMonthButton.disabled =
        displayedMonth.getTime() >= currentMonth.getTime();
}

previousMonthButton.addEventListener("click", function () {
    displayedMonth = new Date(
        displayedMonth.getFullYear(),
        displayedMonth.getMonth() - 1,
        1
    );

    renderCalendar();
});

nextMonthButton.addEventListener("click", function () {
    const currentMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
    );

    if (displayedMonth.getTime() >= currentMonth.getTime()) {
        return;
    }

    displayedMonth = new Date(
        displayedMonth.getFullYear(),
        displayedMonth.getMonth() + 1,
        1
    );

    renderCalendar();
});


/* =====================================
   15. Personal reading insights
===================================== */

function renderReadingInsight() {
    const finished = books.filter(
        book => book.status === "Finished"
    ).length;

    const currentStreak = calculateCurrentStreak();
    const totalSessions = readingSessions.length;

    let message;

    if (currentStreak >= 2) {
        message =
            `You're on a ${currentStreak}-day reading streak. ` +
            "Keep making time for the stories you enjoy!";
    } else if (currentStreak === 1) {
        message =
            "You've recorded a reading session today. " +
            "Come back tomorrow to build your streak!";
    } else if (finished > 0) {
        message =
            `You've finished ${finished} ${finished === 1 ? "book" : "books"}. ` +
            "Every completed story is an achievement!";
    } else if (totalSessions > 0) {
        message =
            `You've recorded ${totalSessions} reading ` +
            `${totalSessions === 1 ? "session" : "sessions"}. ` +
            "Keep building your reading habit!";
    } else if (books.length > 0) {
        message =
            "Your library is ready. Record a reading session " +
            "when you spend time with one of your books.";
    } else {
        message =
            "Your reading journey starts with one page. " +
            "Add a book and record your first reading session!";
    }

    readingInsightText.textContent = message;
}


/* =====================================
   16. Update Reading Journey
===================================== */

function renderReadingJourney() {
    currentStreakElement.textContent = calculateCurrentStreak();
    longestStreakElement.textContent = calculateLongestStreak();

    const today = getLocalDateKey();
    const alreadyRecorded = readingSessions.includes(today);

    recordSessionButton.disabled = alreadyRecorded;

    recordSessionButton.innerHTML = alreadyRecorded
        ? "✓ Today's Session Recorded"
        : "<span aria-hidden=\"true\">✓</span> Record Today's Reading";

    renderCalendar();
    renderReadingInsight();
}


/* =====================================
   17. Initialize the app
===================================== */

function initializeApp() {
    try {
        // Accessing localStorage itself can fail in restricted browsers.
        const testKey = "__bookTrackerStorageTest__";

        localStorage.setItem(testKey, "test");
        localStorage.removeItem(testKey);
    } catch (error) {
        storageAvailable = false;

        console.error("Browser storage is unavailable:", error);

        showFeedback(
            formFeedback,
            "Browser storage is unavailable. You can try the app, but changes may not survive a refresh.",
            "error"
        );
    }

    books = loadBooks();
    readingSessions = loadReadingSessions();

    // Show the current month's calendar on startup.
    displayedMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1
    );

    renderBooks();
    renderStatistics();
    renderReadingJourney();

    // Ensure the storage warning is not lost during initialization.
    if (!storageAvailable) {
        showStorageWarning(formFeedback);
    }
}

initializeApp();