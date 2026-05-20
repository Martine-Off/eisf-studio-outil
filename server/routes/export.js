const express = require('express');
const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType } = require('docx');
const PDFDocument = require('pdfkit');
const pool = require('../models/db');
const authMiddleware = require('../middleware/auth');
const { format } = require('date-fns');

function generateExportFilename(podcastTitle, projectTitle, type, extension) {
    const datePrefix = format(new Date(), 'yyMMdd');
    const cleanPodcastTitle = (podcastTitle || 'Chapitre').replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '_').replace(/_+/g, '_');
    const cleanProjectTitle = (projectTitle || 'Projet').replace(/[^a-zA-Z0-9\u00C0-\u017F]/g, '_').replace(/_+/g, '_');
    return `${datePrefix}_${cleanPodcastTitle}_${cleanProjectTitle}_${type}.${extension}`;
}

const router = express.Router();

// Export Word Studio
router.get('/word-studio/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        // Récupérer podcast info et project info
        const podcastResult = await pool.query(
            'SELECT p.*, pr.title as project_title FROM podcasts p JOIN projects pr ON p.project_id = pr.id WHERE p.id = $1',
            [podcastId]
        );

        if (podcastResult.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }

        const podcast = podcastResult.rows[0];

        // Récupérer dialogues
        const result = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );

        const dialogues = result.rows;

        const ungroundedCount = dialogues.filter(d => d.is_grounded === false).length;
        if (ungroundedCount > 0) {
            return res.status(403).json({ error: `Export bloqué : ${ungroundedCount} réplique${ungroundedCount > 1 ? 's' : ''} non vérifiée${ungroundedCount > 1 ? 's' : ''}. Corrigez-les dans l'éditeur avant d'exporter.` });
        }

        // Bordures pour le tableau
        const borders = {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' },
        };

        // En-tête du tableau
        const headerRow = new TableRow({
            tableHeader: true,
            children: [
                new TableCell({
                    borders,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Personnage', bold: true, color: 'FFFFFF', font: 'Open Sans', size: 20 })] })],
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: '3465AE' },
                }),
                new TableCell({
                    borders,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Texte', bold: true, color: 'FFFFFF', font: 'Open Sans', size: 20 })] })],
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: '3465AE' },
                }),
                new TableCell({
                    borders,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Duree', bold: true, color: 'FFFFFF', font: 'Open Sans', size: 20 })] })],
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: '3465AE' },
                }),
                new TableCell({
                    borders,
                    children: [new Paragraph({ children: [new TextRun({ text: 'Section', bold: true, color: 'FFFFFF', font: 'Open Sans', size: 20 })] })],
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: '3465AE' },
                }),
            ],
        });

        // Lignes de dialogue
        const dialogueRows = dialogues.map(d => new TableRow({
            children: [
                new TableCell({
                    borders,
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: d.character === 'ines' ? 'Inès' : 'Yannick',
                            bold: true,
                            color: d.character === 'ines' ? '3465AE' : 'E63337',
                            font: 'Open Sans',
                            size: 20,
                        })]
                    })],
                }),
                new TableCell({
                    borders,
                    children: [new Paragraph({
                        children: [new TextRun({ text: d.text_studio, font: 'Open Sans', size: 20 })]
                    })],
                }),
                new TableCell({
                    borders,
                    children: [new Paragraph({
                        children: [new TextRun({ text: formatDuration(d.duration_seconds || 0), font: 'Open Sans', size: 20 })]
                    })],
                }),
                new TableCell({
                    borders,
                    children: [new Paragraph({
                        children: [new TextRun({ text: d.section || '', font: 'Open Sans', size: 18, italics: true })]
                    })],
                }),
            ],
        }));

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: 'Podcast EISF - Version Studio', bold: true, size: 32, font: 'Open Sans', color: '3465AE' })],
                        heading: HeadingLevel.HEADING_1,
                        spacing: { after: 200 },
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: podcast.title, size: 28, font: 'Open Sans', color: '3465AE' })],
                        heading: HeadingLevel.HEADING_2,
                        spacing: { after: 400 },
                    }),
                    new Table({
                        rows: [headerRow, ...dialogueRows],
                        width: { size: 100, type: WidthType.PERCENTAGE },
                    }),
                ],
            }],
        });

        const buffer = await Packer.toBuffer(doc);

        const filename = generateExportFilename(podcast.title, podcast.project_title, 'studio', 'docx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Erreur export Word:', error);
        res.status(500).json({ error: "Erreur lors de l'export" });
    }
});

// Export Word Lecture (version sans parenthèses phonétiques)
router.get('/word-lecture/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        const podcastResult = await pool.query('SELECT p.*, pr.title as project_title FROM podcasts p JOIN projects pr ON p.project_id = pr.id WHERE p.id = $1', [podcastId]);
        if (podcastResult.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }
        const podcast = podcastResult.rows[0];

        const result = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );

        const dialogues = result.rows;

        const ungroundedCount = dialogues.filter(d => d.is_grounded === false).length;
        if (ungroundedCount > 0) {
            return res.status(403).json({ error: `Export bloqué : ${ungroundedCount} réplique${ungroundedCount > 1 ? 's' : ''} non vérifiée${ungroundedCount > 1 ? 's' : ''}. Corrigez-les dans l'éditeur avant d'exporter.` });
        }

        const doc = new Document({
            sections: [{
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: 'Podcast EISF - Version Lecture', bold: true, size: 32, font: 'Open Sans', color: '3465AE' })],
                        heading: HeadingLevel.HEADING_1,
                        spacing: { after: 400 },
                    }),
                    ...dialogues.map(d => new Paragraph({
                        children: [
                            new TextRun({
                                text: `${d.character === 'ines' ? 'Inès' : 'Yannick'} : `,
                                bold: true,
                                color: d.character === 'ines' ? '3465AE' : 'E63337',
                                font: 'Open Sans',
                                size: 22,
                            }),
                            new TextRun({
                                text: d.text_reading || d.text_studio,
                                font: 'Open Sans',
                                size: 22,
                            }),
                        ],
                        spacing: { after: 200 },
                    })),
                ],
            }],
        });

        const buffer = await Packer.toBuffer(doc);
        const filename = generateExportFilename(podcast.title, podcast.project_title, 'lecture', 'docx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(buffer);
    } catch (error) {
        console.error('Erreur export Word Lecture:', error);
        res.status(500).json({ error: "Erreur lors de l'export" });
    }
});

// ==========================================
// EXPORTS PDF
// ==========================================

router.get('/pdf-studio/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        const podcastResult = await pool.query('SELECT p.*, pr.title as project_title FROM podcasts p JOIN projects pr ON p.project_id = pr.id WHERE p.id = $1', [podcastId]);
        if (podcastResult.rows.length === 0) return res.status(404).json({ error: 'Podcast non trouvé' });
        const podcast = podcastResult.rows[0];

        const result = await pool.query('SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC', [podcastId]);
        const dialogues = result.rows;

        const ungroundedCount = dialogues.filter(d => d.is_grounded === false).length;
        if (ungroundedCount > 0) {
            return res.status(403).json({ error: `Export bloqué : ${ungroundedCount} réplique${ungroundedCount > 1 ? 's' : ''} non vérifiée${ungroundedCount > 1 ? 's' : ''}. Corrigez-les dans l'éditeur avant d'exporter.` });
        }

        const doc = new PDFDocument({ margin: 50 });

        const filename = generateExportFilename(podcast.title, podcast.project_title, 'studio', 'pdf');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        doc.fontSize(24).font('Helvetica-Bold').text('Podcast EISF - Version Studio', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(18).fillColor('#3465AE').font('Helvetica').text(podcast.title, { align: 'center' });
        doc.moveDown(2);

        const startX = 50;

        dialogues.forEach(d => {
            const isYannick = d.character === 'yannick';
            const color = isYannick ? '#E63337' : '#3465AE';
            const name = isYannick ? 'Yannick' : 'Inès';

            doc.fontSize(12).fillColor(color).font('Helvetica-Bold').text(name, startX, doc.y);
            doc.fontSize(10).fillColor('gray').font('Helvetica-Oblique').text(`[${formatDuration(d.duration_seconds || 0)}] ${d.section || ''}`, startX + 100, doc.y - 12);
            doc.moveDown(0.5);
            doc.fontSize(12).fillColor('black').font('Helvetica').text(d.text_studio, startX, doc.y, { width: 500, align: 'justify' });
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        console.error('Erreur export PDF Studio:', error);
        res.status(500).json({ error: "Erreur lors de l'export PDF" });
    }
});

router.get('/pdf-lecture/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        const podcastResult = await pool.query('SELECT p.*, pr.title as project_title FROM podcasts p JOIN projects pr ON p.project_id = pr.id WHERE p.id = $1', [podcastId]);
        if (podcastResult.rows.length === 0) return res.status(404).json({ error: 'Podcast non trouvé' });
        const podcast = podcastResult.rows[0];

        const result = await pool.query('SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC', [podcastId]);
        const dialogues = result.rows;

        const ungroundedCount = dialogues.filter(d => d.is_grounded === false).length;
        if (ungroundedCount > 0) {
            return res.status(403).json({ error: `Export bloqué : ${ungroundedCount} réplique${ungroundedCount > 1 ? 's' : ''} non vérifiée${ungroundedCount > 1 ? 's' : ''}. Corrigez-les dans l'éditeur avant d'exporter.` });
        }

        const doc = new PDFDocument({ margin: 50 });

        const filename = generateExportFilename(podcast.title, podcast.project_title, 'lecture', 'pdf');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        doc.fontSize(24).font('Helvetica-Bold').text('Podcast EISF - Version Lecture', { align: 'center' });
        doc.moveDown();
        doc.fontSize(18).fillColor('#3465AE').font('Helvetica').text(podcast.title, { align: 'center' });
        doc.moveDown(2);

        dialogues.forEach(d => {
             const isYannick = d.character === 'yannick';
             const color = isYannick ? '#E63337' : '#3465AE';
             const name = isYannick ? 'Yannick' : 'Inès';

             doc.font('Helvetica-Bold').fontSize(14).fillColor(color).text(`${name} : `, { continued: true });
             doc.font('Helvetica').fontSize(14).fillColor('black').text(d.text_reading || d.text_studio);
             doc.moveDown(0.5);
        });

        doc.end();
    } catch (error) {
        console.error('Erreur export PDF Lecture:', error);
        res.status(500).json({ error: "Erreur export PDF" });
    }
});

// Export JSON
router.get('/json/:podcastId', authMiddleware, async (req, res) => {
    try {
        const { podcastId } = req.params;

        const podcastResult = await pool.query('SELECT p.*, pr.title as project_title FROM podcasts p JOIN projects pr ON p.project_id = pr.id WHERE p.id = $1', [podcastId]);
        const dialoguesResult = await pool.query(
            'SELECT * FROM dialogues WHERE podcast_id = $1 ORDER BY order_index ASC',
            [podcastId]
        );

        if (podcastResult.rows.length === 0) {
            return res.status(404).json({ error: 'Podcast non trouvé' });
        }

        const podcast = podcastResult.rows[0];
        const dialogues = dialoguesResult.rows;

        const ungroundedCount = dialogues.filter(d => d.is_grounded === false).length;
        if (ungroundedCount > 0) {
            return res.status(403).json({ error: `Export bloqué : ${ungroundedCount} réplique${ungroundedCount > 1 ? 's' : ''} non vérifiée${ungroundedCount > 1 ? 's' : ''}. Corrigez-les dans l'éditeur avant d'exporter.` });
        }

        // Calculer stats
        const inesWords = dialogues
            .filter(d => d.character === 'ines')
            .reduce((sum, d) => sum + d.text_studio.split(/\s+/).length, 0);
        const yannickWords = dialogues
            .filter(d => d.character === 'yannick')
            .reduce((sum, d) => sum + d.text_studio.split(/\s+/).length, 0);
        const totalWords = inesWords + yannickWords;

        const output = {
            podcast_id: podcast.id,
            title: podcast.title,
            duration_seconds: podcast.duration_seconds,
            word_count: podcast.word_count,
            created_at: podcast.created_at,
            characters: {
                ines: {
                    speaking_time_percent: totalWords > 0 ? Math.round((inesWords / totalWords) * 100) : 0,
                    word_count: inesWords,
                },
                yannick: {
                    speaking_time_percent: totalWords > 0 ? Math.round((yannickWords / totalWords) * 100) : 0,
                    word_count: yannickWords,
                },
            },
            dialogues: dialogues.map(d => ({
                order: d.order_index,
                character: d.character,
                text_studio: d.text_studio,
                text_reading: d.text_reading,
                section: d.section,
                duration_seconds: d.duration_seconds,
            })),
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${generateExportFilename(podcast.title, podcast.project_title, 'data', 'json')}"`);
        res.json(output);
    } catch (error) {
        console.error('Erreur export JSON:', error);
        res.status(500).json({ error: "Erreur lors de l'export" });
    }
});

function formatDuration(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

module.exports = router;
