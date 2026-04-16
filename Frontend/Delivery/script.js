/*
 * Controle de navegacao das paginas do formulario Delivery.
 * Responsavel por trocar etapas, registrar estrelas e abrir/fechar submenu.
 */
const labels = ['', 'Pessimo', 'Ruim', 'Regular', 'Bom', 'Excelente'];

function goTo(n) {
    document.querySelectorAll('.page').forEach((page) => page.classList.remove('active'));
    const id = n === 0 ? 'home' : `p${n}`;
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
}

function rate(page, value) {
    document.querySelectorAll(`#stars-${page} .star`).forEach((star, index) => {
        star.classList.toggle('selected', index < value);
    });
    document.getElementById(`label-${page}`).textContent = labels[value];
    document.getElementById(`btn-${page}`).disabled = false;
}

function toggleSub(item) {
    const sub = item.nextElementSibling;
    const isOpen = sub.classList.contains('open');

    document.querySelectorAll('.submenu.open').forEach((submenu) => {
        submenu.classList.remove('open');
        submenu.previousElementSibling.classList.remove('expanded');
    });

    if (!isOpen) {
        sub.classList.add('open');
        item.classList.add('expanded');
    }
}
