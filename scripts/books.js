// fetch data from google sheets using cloud api key and construct CSV
function fetchCSVData() {
    const sheetId = '1moYiL52ZN9F20QZ-uYoO91Bh3AtkJYEoNcyv6MuRI2Y';
    const sheetRange = 'Sheet1';
    const apiKey = 'AIzaSyAGQtw4Jdd-BCe6-8PIRfUeQp8lwKJurfE';

    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetRange}?key=${apiKey}`;

    return fetch(url)
        .then(response => response.json())
        .then(data => {
            const rows = data.values;
            const headers = rows[0];
            return rows.slice(1).map(row => {
                const obj = {};
                headers.forEach((header, index) => {
                    if (header.trim() === "embedding") {
                        obj[header.trim()] = JSON.parse(row[index] || '[]');
                    } else if (header.trim() === "embedding_2d") {
                        const embedding = JSON.parse(row[index] || '[0,0]');
                        if (embedding.length >= 2) {
                            console.log(embedding[0])
                            obj["x"] = embedding[0];
                            obj["y"] = embedding[1];
                        }
                    } else {
                        obj[header.trim()] = row[index] || '';
                    }
                });
                return obj;
            });
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            throw error;
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
function generateBooksHTML(books) {
    return books.map(book => `
    <div class="book">
        <img src="https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg" alt="${book.title}" class="book-image">
        <div class="flex-column book-text">
            <p class="book-title">${book.title}</p>
            <p>${book.author}</p>
            <p class="rating">${'★'.repeat(book.rating)}</p>
        </div>
    </div>
    `).join('');
}

function generateBookHTML(book, x, y) {
    return `
    <div class="book" style="position: absolute; left: ${x - 25}px; top: ${y - 35}px;">
        <img src="https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg" alt="${book.title}" class="book-image" style="width: 50px; height: 75px; transition: transform 0.3s;">
        <div class="flex-column book-text">
            <p class="book-title">${book.title}</p>
            <p>${book.author}</p>
            <p class="rating">${'★'.repeat(book.rating)}</p>
        </div>
    </div>
    `
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
function displayBooks(sortBy, selectedShelf, selectedAuthor) {
    fetchCSVData()
        .then(csvData => {
            const allBooks = (csvData);
            const shelfBooks = filterBooksByShelf(allBooks, selectedShelf);
            const authorBooks = filterBooksByAuthor(shelfBooks, selectedAuthor);
            const sortedBooks = sortBooks(authorBooks, sortBy);
            document.getElementById('book-container').innerHTML = generateBooksHTML(sortedBooks);

            createScatterPlot(allBooks, sortedBooks);

        })
        .catch(error => {
            console.error('Error fetching or processing CSV:', error);
        });
}

// Generate HTML element for scatter plot of selected books based on x and y values, normalized for all books
function createScatterPlot(allBooks, books) {
    const container = document.getElementById('embeddingChart');
    container.innerHTML = '';
    container.style.position = 'relative';
    container.style.width = '1400px';
    container.style.height = '600px';

    // Find min and max values across all books for scaling the positions
    const minX = Math.min(...allBooks.map(book => book.x));
    const maxX = Math.max(...allBooks.map(book => book.x));
    const minY = Math.min(...allBooks.map(book => book.y));
    const maxY = Math.max(...allBooks.map(book => book.y));

    // Normalize the positions of selected books (scale them to fit inside the container)
    books.forEach(book => {
        const normalizedX = (book.x - minX) / (maxX - minX) * container.offsetWidth;
        const normalizedY = (book.y - minY) / (maxY - minY) * container.offsetHeight;
        console.log('book.x: ', book.x)
        console.log('maxX: ', maxX)
        console.log('minX: ', minX)
        console.log('container.offsetWidth: ', container.offsetWidth)
        console.log('normalizedX: ', normalizedX)


        bookHTML = generateBookHTML(book, normalizedX - 25, normalizedY - 35)
        container.innerHTML += bookHTML;

        // // Create the img element for the book cover
        // const img = document.createElement('img');
        // img.src = `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`;
        // img.alt = book.title;
        // img.style.position = 'absolute';
        // img.style.left = `${normalizedX - 25}px`;
        // img.style.top = `${normalizedY - 35}px`;
        // img.style.width = '50px';
        // img.style.height = '75px';
        // img.style.transition = 'transform 0.3s';
        // img.className = 'book-image';

        // // Append the img to the container
        // container.appendChild(img);



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
    displayBooks(sortBy, selectedShelf, selectedAuthor);
}

// Event listeners
document.getElementById('sort-select').addEventListener('change', (event) => { processEvent()});
document.getElementById('shelf-select').addEventListener('change', (event) => { processEvent()});
document.getElementById('author-select').addEventListener('change', (event) => { processEvent()});


// Initial load
window.addEventListener('load', () => {
    fetchCSVData()
        .then(csvData => {
            allBooks = (csvData);
            populateShelfDropdown();
            populateAuthorfDropdown();
            displayBooks('date read', '', ''); // Default sorting and no filter
        })
        .catch(error => {
            console.error('Error fetching or processing CSV:', error);
        });
});