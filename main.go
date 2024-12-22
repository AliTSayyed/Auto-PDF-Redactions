package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/color"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

type PersonalInfo struct {
	Text       string  `json:"text"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Width      float64 `json:"width"`
	Height     float64 `json:"height"`
	PageWidth  float64 `json:"pageWidth"`
	PageHeight float64 `json:"pageHeight"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/v1/candidate-resume-pdf", handlePDF)

	fmt.Println("Server Started on Port 8080")
	err := http.ListenAndServe(":8080", mux)
	if err != nil {
		log.Fatal(err)
	}
}

func handlePDF(w http.ResponseWriter, r *http.Request) {

	fmt.Println("PDF POST request recieved")

	var pdfData struct {
		PDF          string         `json:"pdf_string"`
		MatchedTexts []PersonalInfo `json:"matched_texts"`
	}

	// decode the json body into a json formated struct
	err := json.NewDecoder(r.Body).Decode(&pdfData)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	defer r.Body.Close()

	// decode string pdf to a file form
	pdfFile, err := base64.StdEncoding.DecodeString(pdfData.PDF)
	if err != nil {
		http.Error(w, "Invalid base64 string:"+err.Error(), http.StatusBadRequest)
		return
	}

	// add watermark and redatcions to pdf
	pdfFile, err = processPDF(pdfFile, "images/brain-logo-watermark.png", pdfData.MatchedTexts)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set headers for pdf file download
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", `attachment; filename="candidate-resume.pdf"`)
	w.Header().Set("Content-Length", fmt.Sprintf("%d", len(pdfFile)))
	w.WriteHeader(http.StatusOK)

	// send the pdf
	w.Write(pdfFile)

}

func addRedaction(pdfFile []byte, matchedTexts []PersonalInfo) ([]byte, error) {
	// Create temporary files for input/output for first iteration
	tmpInput, err := os.CreateTemp("", "input*.pdf")
	if err != nil {
		return nil, fmt.Errorf("failed to create temp input file: %v", err)
	}
	defer os.Remove(tmpInput.Name())

	// Write initial PDF to temp file
	if _, err := tmpInput.Write(pdfFile); err != nil {
		return nil, fmt.Errorf("failed to write to temp file: %v", err)
	}
	tmpInput.Close()

	currentInputFile := tmpInput.Name()
	conf := model.NewDefaultConfiguration()
	black := color.SimpleColor{R: 0, G: 0, B: 0}

	// Process each text location
	for i, textLoc := range matchedTexts {
		// Create temp output file for this iteration
		tmpOutput, err := os.CreateTemp("", "output*.pdf")
		if err != nil {
			return nil, fmt.Errorf("failed to create temp output file: %v", err)
		}
		defer os.Remove(tmpOutput.Name())
		tmpOutput.Close()

		// Create rectangle for this text location
		rect := types.Rectangle{
			LL: types.Point{
				X: textLoc.X,
				Y: textLoc.Y,
			},
			UR: types.Point{
				X: textLoc.X + textLoc.Width,
				Y: textLoc.Y + textLoc.Height,
			},
		}

		// Create square annotation
		ann := model.NewSquareAnnotation(
			rect,
			"",                         // contents
			fmt.Sprintf("redact%d", i), // unique id for each annotation
			types.DateString(time.Now()),
			0, // flags
			&black,
			"",         // title
			nil,        // popup indirect ref
			nil,        // opacity
			"",         // rich text
			"",         // subject
			&black,     // fill color
			0, 0, 0, 0, // margins
			1,             // border width
			model.BSSolid, // border style
			false,         // cloudy border
			0,             // cloudy border intensity
		)

		// Add annotation to the current state of the PDF
		pages := []string{"1"}
		if err := api.AddAnnotationsFile(currentInputFile, tmpOutput.Name(), pages, ann, conf, false); err != nil {
			return nil, fmt.Errorf("failed to add annotation %d: %v", i, err)
		}

		// Update currentInputFile for next iteration
		currentInputFile = tmpOutput.Name()
	}

	// Read final output file
	outputBytes, err := os.ReadFile(currentInputFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read final output file: %v", err)
	}

	return outputBytes, nil
}

func addWaterMark(pdfBytes []byte, watermarkImagePath string) ([]byte, error) {

	// Convert our byte slice into something we can read from and seek in
	pdfReader := bytes.NewReader(pdfBytes)

	// Create a place to store the output
	var outputBuffer bytes.Buffer

	// Get default PDF processing settings
	conf := model.NewDefaultConfiguration()

	// Define how the watermark should look
	description := "scale:0.6 rel, pos:c, rot:0, op:0.1"

	// Create the watermark object from our image
	watermark, err := api.ImageWatermark(
		watermarkImagePath, // Image file to use
		description,        // How to display it
		false,              // Put it behind content
		false,              // Don't update existing watermarks
		types.POINTS,       // Use points for measurements
	)
	if err != nil {
		return nil, fmt.Errorf("error creating watermark: %w", err)
	}

	// Apply the watermark to the PDF
	err = api.AddWatermarks(
		pdfReader,      // Source PDF
		&outputBuffer,  // Where to write the result
		[]string{"1-"}, // Which pages (all of them)
		watermark,      // The watermark we created
		conf,           // Processing settings
	)
	if err != nil {
		return nil, fmt.Errorf("could not add watermark to pdf: %w", err)
	}

	return outputBuffer.Bytes(), nil
}

func processPDF(pdfFile []byte, watermarkImagePath string, matchedTexts []PersonalInfo) ([]byte, error) {
	// First add the redactions
	pdfWithRedactions, err := addRedaction(pdfFile, matchedTexts)
	if err != nil {
		return nil, fmt.Errorf("failed to add redactions: %w", err)
	}

	// Then add the watermark to the redacted PDF
	pdfWithWatermark, err := addWaterMark(pdfWithRedactions, watermarkImagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to add watermark: %w", err)
	}

	return pdfWithWatermark, nil
}
