# Opt-in H750 DShot300 LAB diagnostics (only Task 18).
# All counters are cumulative since the H750 boot.
# Message is read-only; does not alter command or RPM packet formats.
std_msgs/Header header
uint8 dshot_id
uint32 tx_complete
uint32 capture_calls
uint32 no_start_edge
uint32 edge_overflow
uint32 decode_ok
uint32 decode_fail
uint32 total_edges
uint32 last_edge_count
uint32 last_ok_age_ms
uint32 no_capture_window
