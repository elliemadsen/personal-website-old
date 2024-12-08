// fetch data from google sheets using cloud api key and construct CSV
function fetchCSVData() {
  const sheetId = "1moYiL52ZN9F20QZ-uYoO91Bh3AtkJYEoNcyv6MuRI2Y";
  const sheetRange = "Sheet1";
  const apiKey = "AIzaSyAGQtw4Jdd-BCe6-8PIRfUeQp8lwKJurfE";

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetRange}?key=${apiKey}`;

  return fetch(url)
    .then((response) => response.json())
    .then((data) => {
      const rows = data.values;
      const headers = rows[0];
      return rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header.trim() === "embedding_2d") {
            const embedding = JSON.parse(row[index] || "[0,0]");
            if (embedding.length >= 2) {
              obj["x"] = embedding[0];
              obj["y"] = embedding[1];
            }
          } else {
            obj[header.trim()] = row[index] || "";
          }
        });
        return obj;
      });
    })
    .catch((error) => {
      console.error("Error fetching data:", error);
      throw error;
    });
}

// Parse a CSV line, handling quoted fields
function parseCSVLine(line) {
  const regex = /("(?:[^"]|"")*")|([^,"]+)/g;
  const values = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
    values.push(match[0].replace(/(^"|"$)/g, "").replace(/""/g, '"')); // Remove surrounding quotes and handle doubled quotes
  }
  return values;
}

// Generate HTML for book objects (bookshelf)
function generateBooksHTML(books) {
  return books
    .map(
      (book) => `
    <div class="book">
        <img src="https://covers.openlibrary.org/b/isbn/${
          book.isbn
        }-L.jpg" alt="${book.title}" class="book-image">
        <div class="flex-column book-text">
            <p>${book.title}</p>
            <p>${book.author}</p>
            <p class="rating">${"★".repeat(book.rating)}</p>
        </div>
    </div>
    `
    )
    .join("");
}

// Sort books based on criteria
function sortBooks(books, criteria) {
  function sortByDate(a, b) {
    const dateA = new Date(a["date read"]);
    const dateB = new Date(b["date read"]);
    if (isNaN(dateA.getTime())) return 1;
    if (isNaN(dateB.getTime())) return -1;
    return dateB - dateA;
  }
  return books.slice().sort((a, b) => {
    if (criteria === "date read") {
      return sortByDate(a, b);
    } else if (criteria === "rating") {
      const ratingComparison = b.rating - a.rating;
      if (ratingComparison !== 0) return ratingComparison;
      return sortByDate(a, b);
    } else {
      return a[criteria].localeCompare(b[criteria]);
    }
  });
}

// Filter books based on the selected shelf
function filterBooksByShelf(books, shelf) {
  if (!shelf) return books;
  return books.filter((book) => {
    return book.bookshelves
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .includes(shelf.toLowerCase());
  });
}

// Filter books based on the selected author
function filterBooksByAuthor(books, author) {
  if (!author) return books;
  return books.filter((book) => {
    return book.author == author;
  });
}

// Load books, sort, and filter based on user input
function displayBooks(sortBy, selectedShelf, selectedAuthor) {
  fetchCSVData()
    .then((csvData) => {
      const allBooks = csvData;
      const shelfBooks = filterBooksByShelf(allBooks, selectedShelf);
      const authorBooks = filterBooksByAuthor(shelfBooks, selectedAuthor);
      const sortedBooks = sortBooks(authorBooks, sortBy);
      document.getElementById("book-container").innerHTML =
        generateBooksHTML(sortedBooks);

      createScatterPlot(allBooks, sortedBooks);
    })
    .catch((error) => {
      console.error("Error fetching or processing CSV:", error);
    });
}

let transformState = d3.zoomIdentity;
let isInitialLoad = true;
const width = 1500;
const height = 1000;

function createScatterPlot(allBooks, books) {
  const container = document.getElementById("embeddingChart");
  container.innerHTML = "";

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const imageGroup = svg.append("g");

  // Add zoom event
  const zoom = d3
    .zoom()
    .scaleExtent([0.5, 10])
    .on("zoom", (event) => {
      transformState = event.transform;
      imageGroup.attr("transform", transformState);
    });

  // Apply the zoom behavior to the SVG
  svg.call(zoom);

  // Restore previous zoom state if available
  svg.call(zoom.transform, transformState);

  // On the first load, center the plot within the container
  if (isInitialLoad) {
    const offsetX = (container.clientWidth - width) / 2;
    const offsetY = (container.clientHeight - height) / 2;
    imageGroup.attr("transform", `translate(${offsetX}, ${offsetY})`);
    isInitialLoad = false;
  }

  // Find min and max values for scaling the positions
  const minX = Math.min(...allBooks.map((book) => book.x));
  const maxX = Math.max(...allBooks.map((book) => book.x));
  const minY = Math.min(...allBooks.map((book) => book.y));
  const maxY = Math.max(...allBooks.map((book) => book.y));

  // Function to normalize the x and y positions
  function normalize(value, min, max, size) {
    return ((value - min) / (max - min)) * size;
  }

  book_width = 40;
  book_height = book_width * 1.5;

  // Add book covers
  books.forEach((book) => {
    if (book.x !== 0 && book.y !== 0) {
      const normalizedX = normalize(book.x, minX, maxX, width);
      const normalizedY = normalize(book.y, minY, maxY, height);

      imageGroup
        .append("image")
        .attr(
          "xlink:href",
          `https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`
        )
        .attr("x", normalizedX - book_width / 2)
        .attr("y", normalizedY - book_height / 2)
        .attr("width", book_width)
        .attr("height", book_height)
        .attr("alt", book.title)
        .on("mouseover", function () {
          d3.select(this).style("opacity", 0.7); // Hover effect
          showBookDetails(book.title, book.author);
        })
        .on("mouseout", function () {
          d3.select(this).style("opacity", 1);
          hideBookDetails(book.title);
        });
    }
  });

  // Popup to show book titles on hover
  function showBookDetails(title, author, event) {
    const tooltip = d3
      .select("body")
      .append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0, 0, 0, 0.5)")
      .style("color", "#fff")
      .style("padding", "5px")
      .style("border-radius", "4px")
      .style("pointer-events", "none")
      .html(title + "<br>" + author)
      .style("opacity", 1);

    d3.select("body").on("mousemove", function (event) {
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    });
  }

  // Hide the popup
  function hideBookDetails(title) {
    d3.select(".tooltip").remove();
  }
}

// Populate authors dropdown including all authors with > 2 books rated > 1 star
function populateAuthorfDropdown() {
  const authorCount = new Map();

  allBooks.forEach((book) => {
    if (book.rating > 1) {
      const author = book.author;
      authorCount.set(author, (authorCount.get(author) || 0) + 1);
    }
  });

  const authorsWithMultipleBooks = Array.from(authorCount.entries())
    .filter(([author, count]) => count > 2)
    .map(([author]) => author)
    .sort();

  const authorSelect = document.getElementById("author-select");

  authorsWithMultipleBooks.forEach((author) => {
    const option = document.createElement("option");
    option.value = author;
    option.textContent = author;
    authorSelect.appendChild(option);
  });
}

// Populate bookshelf dropdown with unique values from the books data
function populateShelfDropdown() {
  const shelves = new Set();
  allBooks.forEach((book) => {
    if (book.bookshelves) {
      book.bookshelves.split(",").forEach((shelf) => {
        const trimmedShelf = shelf.trim().toLowerCase();
        if (trimmedShelf) {
          shelves.add(trimmedShelf);
        }
      });
    }
  });

  const shelfSelect = document.getElementById("shelf-select");

  sortedShelves = Array.from(shelves).sort();

  sortedShelves.forEach((shelf) => {
    const option = document.createElement("option");
    option.value = shelf;
    option.textContent = shelf;
    shelfSelect.appendChild(option);
  });
}

function processEvent() {
  const sortBy = document.getElementById("sort-select").value;
  const selectedShelf = document.getElementById("shelf-select").value;
  const selectedAuthor = document.getElementById("author-select").value;
  displayBooks(sortBy, selectedShelf, selectedAuthor);
}

// Event listeners
document.getElementById("sort-select").addEventListener("change", (event) => {
  processEvent();
});
document.getElementById("shelf-select").addEventListener("change", (event) => {
  processEvent();
});
document.getElementById("author-select").addEventListener("change", (event) => {
  processEvent();
});

// Initial load
window.addEventListener("load", () => {
  fetchCSVData()
    .then((csvData) => {
      allBooks = csvData;
      populateShelfDropdown();
      populateAuthorfDropdown();
      displayBooks("date read", "", ""); // Default sorting and no filter
    })
    .catch((error) => {
      console.error("Error fetching or processing CSV:", error);
    });
});
