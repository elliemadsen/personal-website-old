// Fetch CSV data from the server
function fetchCSVData() {
    return fetch('/javascript/books.csv')
        .then(response => response.text());
}

// Convert CSV string to JavaScript objects
function csvToObjects(csvString) {
    const lines = csvString.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    return lines.slice(1).map(line => {
        const values = parseCSVLine(line);
        const obj = {};
        headers.forEach((header, index) => {
            obj[header.trim()] = values[index] || '';
        });
        return obj;
    });
}

// Parse a CSV line, handling quoted fields
function parseCSVLine(line) {
    const regex = /("(?:[^"]|"")*")|([^,"]+)/g;
    const values = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
        values.push(match[0].replace(/(^"|"$)/g, '').replace(/""/g, '"')); // Remove surrounding quotes and handle doubled quotes
    }
    return values;
}

// Generate HTML for book objects
function generateBookHTML(books) {
    return books.map(book => `
    <div class="book">
        <img src="https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg" alt="${book.title} cover" class="book-image">
        <div class="flex-column book-text">
            <p class="book-title">${book.title}</p>
            <p>${book.author}</p>
            <p class="rating">${'★'.repeat(book.rating)}</p>
        </div>
    </div>
    `).join('');
}

// Sort books based on criteria
function sortBooks(books, criteria) {
    function sortByDate(a,b) {
        const dateA = new Date(a["date read"]);
        const dateB = new Date(b["date read"]);
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateB - dateA;
    }
    return books.slice().sort((a, b) => {
        if (criteria === 'date read') {
            return sortByDate(a,b)
        } else if (criteria === 'rating') {
            const ratingComparison = b.rating - a.rating;
            if (ratingComparison !== 0) return ratingComparison;
            return sortByDate(a,b)
        } else {
            return a[criteria].localeCompare(b[criteria]);
        }
    });
}

// Filter books based on the selected shelf
function filterBooksByShelf(books, shelf) {
    if (!shelf) return books;
    return books.filter(book => {
        return book.bookshelves.split(',').map(s => s.trim().toLowerCase()).includes(shelf.toLowerCase());
    });
}

// Filter books based on the selected author
function filterBooksByAuthor(books, author) {
    if (!author) return books;
    return books.filter(book => {
        return book.author == author;
    });
}

// Load books, sort, and filter based on user input
function loadAndDisplayBooks(sortBy, selectedShelf, selectedAuthor) {
    fetchCSVData()
        .then(csvData => {
            console.log(selectedAuthor);
            const books = csvToObjects(csvData);
            const shelfBooks = filterBooksByShelf(books, selectedShelf);
            const authorBooks = filterBooksByAuthor(shelfBooks, selectedAuthor);
            const sortedBooks = sortBooks(authorBooks, sortBy);
            document.getElementById('book-container').innerHTML = generateBookHTML(sortedBooks);
        })
        .catch(error => {
            console.error('Error fetching or processing CSV:', error);
        });
}

// Populate authors dropdown including all authors with > 2 books in the library
function populateAuthorfDropdown() {
    const authorCount = new Map();

    allBooks.forEach(book => {
        if (book.rating > 1) {
            const author = book.author;
            authorCount.set(author, (authorCount.get(author) || 0) + 1);
        }
    });

    const authorsWithMultipleBooks = Array.from(authorCount.entries())
        .filter(([author, count]) => count > 2)
        .map(([author]) => author)
        .sort();

    console.log(authorsWithMultipleBooks);
        
    const authorSelect = document.getElementById('author-select');

    authorsWithMultipleBooks.forEach(author => {
        const option = document.createElement('option');
        option.value = author;
        option.textContent = author;
        authorSelect.appendChild(option);
    });
}

// Populate bookshelf dropdown with unique values from the books data
function populateShelfDropdown() {
    const shelves = new Set();
    allBooks.forEach(book => {
        if (book.bookshelves) {
            book.bookshelves.split(',').forEach(shelf => {
                const trimmedShelf = shelf.trim().toLowerCase();
                if (trimmedShelf) {
                    shelves.add(trimmedShelf);
                }
            });
        }
    });

    const shelfSelect = document.getElementById('shelf-select');

    sortedShelves = Array.from(shelves).sort();

    sortedShelves.forEach(shelf => {
        const option = document.createElement('option');
        option.value = shelf;
        option.textContent = shelf;
        shelfSelect.appendChild(option);
    });
}

function processEvent() {
    const sortBy = document.getElementById('sort-select').value;
    const selectedShelf = document.getElementById('shelf-select').value;
    const selectedAuthor = document.getElementById('author-select').value;
    loadAndDisplayBooks(sortBy, selectedShelf, selectedAuthor);
}

// Event listeners
document.getElementById('sort-select').addEventListener('change', (event) => { processEvent()});
document.getElementById('shelf-select').addEventListener('change', (event) => { processEvent()});
document.getElementById('author-select').addEventListener('change', (event) => { processEvent()});


// Initial load
window.addEventListener('load', () => {
    fetchCSVData()
        .then(csvData => {
            allBooks = csvToObjects(csvData);
            populateShelfDropdown();
            populateAuthorfDropdown();
            loadAndDisplayBooks('date read', '', ''); // Default sorting and no filter
        })
        .catch(error => {
            console.error('Error fetching or processing CSV:', error);
        });
});