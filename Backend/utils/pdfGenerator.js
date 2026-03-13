function generatePDF() {
    const {jspdf} = window.jspdf;
    const doc = new jspdf();
    doc.setfontSize(12);
    doc.text('Relatorio de avaliações', 10, 10);
    // aqui você pode ler os dados do servidor e formatar o PDF como quiser
    doc.save('relatorio.pdf');
}
    document.getElementById('relatorio-pdf').addEventListener('click', generatePDF);
function questionId(page){
    return 'stars-' + page;
}
function restaurantId(page){
    return 'label-' + page;
}

