document.addEventListener('DOMContentLoaded', function() {
    fetch('../navbar.html')
        .then(response => response.text())
        .then(data => {
            const navbarContainer = document.getElementById('navbar-container');
            navbarContainer.innerHTML = data;

            const links = navbarContainer.querySelectorAll('.nav-item');
            links.forEach(link => {
                if (link.getAttribute('data-page') === window.currentPage) {
                    link.classList.add('selected');
                }
            });
        })
        .catch(error => console.error('Error loading the navbar:', error));
});
