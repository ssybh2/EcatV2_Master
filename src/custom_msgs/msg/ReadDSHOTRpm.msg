# One group of four DShot channels (dshot_id=1 or 2).
# Electrical RPM magnitude only: not signed shaft speed. A 3D/reversing
# motor must NOT infer actual rotation direction from requested direction.
# Valid bits refer to *fresh* CRC-checked samples (<=100 ms on H750).
std_msgs/Header header
uint8 dshot_id
uint8 valid_mask
uint16[4] period_us
uint32[4] electrical_rpm
