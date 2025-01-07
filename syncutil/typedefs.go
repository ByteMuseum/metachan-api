package syncutil

import (
	"encoding/json"
	"fmt"
	"strconv"
)

func (v *StringedOrUnstringedInt) UnmarshalJSON(data []byte) error {
	var strValue string
	if err := json.Unmarshal(data, &strValue); err == nil {
		if strValue == "" {
			v.value = 0
			return nil
		}
		val, err := strconv.Atoi(strValue)
		if err != nil {
			return err
		}
		v.value = val
		return nil
	}

	var intValue int
	if err := json.Unmarshal(data, &intValue); err == nil {
		v.value = intValue
		return nil
	}

	return fmt.Errorf("failed to unmarshal %s into StringedOrUnstringedInt", data)
}

func (v StringedOrUnstringedInt) Value() int {
	return v.value
}
