import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>
        {total === 0 ? 'No results' : `Showing ${start}–${end} of ${total}`}
      </Text>
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.button, page <= 1 && styles.buttonDisabled]}
          onPress={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <Text style={styles.buttonText}>{'‹ Prev'}</Text>
        </TouchableOpacity>
        <Text style={styles.label}>
          Page {page} of {totalPages}
        </Text>
        <TouchableOpacity
          style={[styles.button, page >= totalPages && styles.buttonDisabled]}
          onPress={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          <Text style={styles.buttonText}>{'Next ›'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  label: {
    fontSize: 12,
    color: '#888888',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#cccccc',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444444',
  },
});

export default Pagination;
