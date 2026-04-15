const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, WidthType } = require('docx');
const fs = require('fs');

const doc = new Document({
    sections: [{
        properties: {},
        children: [
            new Paragraph({
                text: "Test",
                heading: HeadingLevel.HEADING_1
            }),
            new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [
                    new TableRow({
                        children: [
                            new TableCell({ children: [new Paragraph("Col 1")] }),
                            new TableCell({ children: [new Paragraph("Col 2")] })
                        ]
                    })
                ]
            })
        ]
    }]
});

Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync('test.docx', buffer);
    console.log("Success");
}).catch(err => {
    console.error(err);
});
