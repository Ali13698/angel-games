package main

import (
	"encoding/binary"
	"encoding/json"
	"unsafe"
)

const heapSize = 1 << 20

var heap [heapSize]byte
var heapOff uint32

//go:wasmexport reset
func reset() {
	heapOff = 0
}

//go:wasmexport allocate
func allocate(size uint32) uint32 {
	if size == 0 || size > heapSize || heapOff > heapSize-size {
		return 0
	}

	ptr := uint32(uintptr(unsafe.Pointer(&heap[0]))) + heapOff
	heapOff += size
	return ptr
}

func sliceAt(addr, size uint32) []byte {
	base := uint32(uintptr(unsafe.Pointer(&heap[0])))
	if addr < base || size == 0 {
		return nil
	}

	offset := addr - base
	if offset > heapOff || size > heapOff-offset {
		return nil
	}

	return heap[offset : offset+size]
}

//go:wasmexport apply
func apply(
	statePtr, stateLen,
	intentPtr, intentLen,
	ctxPtr, ctxLen uint32,
) uint32 {
	var state State
	var intent Intent

	if json.Unmarshal(sliceAt(statePtr, stateLen), &state) != nil {
		return 0
	}

	if json.Unmarshal(sliceAt(intentPtr, intentLen), &intent) != nil {
		return 0
	}

	next, events, err := ApplyCommand(
		state,
		intent.From,
		intent.Cmd.Type,
		intent.Cmd.Payload,
	)
	if err != nil {
		return 0
	}

	result := struct {
		State  State   `json:"state"`
		Events []Event `json:"events"`
	}{next, events}

	data, err := json.Marshal(result)
	if err != nil {
		return 0
	}

	ptr := allocate(uint32(len(data) + 4))
	if ptr == 0 {
		return 0
	}

	dst := sliceAt(ptr, uint32(len(data)+4))
	binary.LittleEndian.PutUint32(dst, uint32(len(data)))
	copy(dst[4:], data)

	return ptr
}

func main() {}
